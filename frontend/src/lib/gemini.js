import 'server-only'
import { GoogleGenAI, ApiError } from '@google/genai'
import { z } from 'zod'

// Server-side Gemini helper for the text chat and report routes.
// GEMINI_MODEL picks the model; if it is unavailable or overloaded we fall
// back through newer Flash models and the rolling "latest Flash" alias.
// (gemini-2.5-flash is closed to new API keys.)
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest']

let workingModel = null

export class GeminiOutputError extends Error {}

/** A short, loggable reason for a fallback; never includes the API key. */
export function failureReason(error) {
  const status = error?.status ? `${error.status} ` : ''
  let message = error?.message ?? String(error)
  try {
    const parsed = JSON.parse(message)
    message = parsed?.error?.message ?? message
  } catch { /* not JSON */ }
  return `${status}${message}`.slice(0, 240)
}

export function hasGemini() {
  return Boolean(process.env.GEMINI_API_KEY)
}

function candidateModels() {
  const list = [workingModel, process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter(Boolean)
  return [...new Set(list)]
}

function jsonSchemaFor(schema) {
  const json = z.toJSONSchema(schema)
  delete json.$schema // Gemini rejects the meta-schema key
  return json
}

// Gemini wants alternating user/model turns starting with user.
function toContents(messages) {
  const contents = []
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'model' : 'user'
    const last = contents[contents.length - 1]
    if (last && last.role === role) last.parts.push({ text: m.content })
    else contents.push({ role, parts: [{ text: m.content }] })
  }
  if (contents[0]?.role !== 'user') contents.unshift({ role: 'user', parts: [{ text: '(start)' }] })
  return contents
}

/**
 * Runs one Gemini call constrained to `schema` and returns the validated
 * object. Throws with a short, key-free reason when the output can't be used.
 *
 * Latency matters (Vercel functions are capped), so thinking is kept low,
 * each attempt is time-boxed, and the whole call has a deadline.
 */
export async function generateStructured({
  system, messages, schema,
  maxOutputTokens = 8192, temperature = 0.4,
  thinkingLevel = 'LOW', attemptTimeoutMs = 12000, deadlineMs = 24000,
}) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const baseConfig = {
    systemInstruction: system,
    temperature,
    maxOutputTokens,
    responseMimeType: 'application/json',
    responseJsonSchema: jsonSchemaFor(schema),
    httpOptions: { timeout: attemptTimeoutMs },
  }
  const contents = toContents(messages)
  const started = Date.now()
  const timeLeft = () => deadlineMs - (Date.now() - started)

  const call = async (model) => {
    try {
      return await ai.models.generateContent({
        model, contents, config: { ...baseConfig, thinkingConfig: { thinkingLevel } },
      })
    } catch (error) {
      // Some models don't accept a thinking level: retry once without it.
      if (error instanceof ApiError && error.status === 400 && /thinking/i.test(error.message)) {
        return ai.models.generateContent({ model, contents, config: baseConfig })
      }
      throw error
    }
  }

  let lastError = null
  let allBusy = true
  // Two passes: if every model was merely busy, wait briefly and retry once.
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) {
      if (!allBusy || timeLeft() < attemptTimeoutMs) break
      await new Promise((r) => setTimeout(r, 1000))
    }
    for (const model of candidateModels()) {
      if (timeLeft() < 3000) break
      try {
        const response = await call(model)
        workingModel = model
        const finish = response.candidates?.[0]?.finishReason
        const text = response.text
        if (!text) {
          throw new GeminiOutputError(`${model}: empty response (finishReason ${finish ?? 'unknown'}, block ${response.promptFeedback?.blockReason ?? 'none'})`)
        }
        let json
        try {
          json = JSON.parse(text)
        } catch {
          throw new GeminiOutputError(`${model}: response was not valid JSON (finishReason ${finish ?? 'unknown'}, ${text.length} chars)`)
        }
        const parsed = schema.safeParse(json)
        if (!parsed.success) {
          const issue = parsed.error.issues[0]
          throw new GeminiOutputError(`${model}: JSON failed validation at ${issue?.path?.join('.') || '(root)'}: ${issue?.message}`)
        }
        return parsed.data
      } catch (error) {
        if (error instanceof GeminiOutputError) throw error
        lastError = error
        // Unknown model, overloaded / rate-limited, or too slow: try the next
        // candidate. Anything else (bad key, bad request) is final.
        const status = error instanceof ApiError ? error.status : 0
        const unknownModel = (status === 404 || status === 400) && /model/i.test(error.message)
        const busy = status === 429 || status === 500 || status === 503
        const timedOut = error?.name === 'AbortError' || error?.name === 'TimeoutError' || /abort|timed? ?out/i.test(error?.message ?? '')
        if (unknownModel || busy || timedOut) {
          console.warn(`[gemini] ${model} failed (${status || error?.name}), trying next model`)
          if (workingModel === model) workingModel = null
          if (!busy) allBusy = false
          if (timedOut) lastError = new Error(`${model} timed out after ${attemptTimeoutMs}ms`)
          continue
        }
        throw error
      }
    }
  }
  throw lastError ?? new Error('No Gemini model answered in time')
}
