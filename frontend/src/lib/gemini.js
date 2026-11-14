import 'server-only'
import { GoogleGenAI, ApiError } from '@google/genai'
import { z } from 'zod'

// Server-side Gemini helper for the text chat and report routes.
// GEMINI_MODEL picks the model; if it is not available to this key we fall
// back to the rolling "latest Flash" alias, then to a long-lived Flash model.
const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash']

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
 * maxOutputTokens is generous on purpose: on thinking-capable Flash models the
 * thinking tokens count against it, and a tight cap truncates the JSON.
 */
export async function generateStructured({ system, messages, schema, maxOutputTokens = 8192, temperature = 0.4 }) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const config = {
    systemInstruction: system,
    temperature,
    maxOutputTokens,
    responseMimeType: 'application/json',
    responseJsonSchema: jsonSchemaFor(schema),
  }
  const contents = toContents(messages)

  let lastError = null
  for (const model of candidateModels()) {
    try {
      const response = await ai.models.generateContent({ model, contents, config })
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
      // Unknown model for this key/region: try the next candidate.
      if (error instanceof ApiError && (error.status === 404 || error.status === 400) && /model/i.test(error.message)) {
        console.warn(`[gemini] model ${model} unavailable (${error.status}), trying next`)
        continue
      }
      throw error
    }
  }
  throw lastError ?? new Error('No Gemini model available')
}
