import 'server-only'
import { GoogleGenAI, ApiError } from '@google/genai'
import { z } from 'zod'

// Server-side Gemini helper for the text chat and report routes.
// GEMINI_MODEL picks the model; if it is not available to this key we fall
// back to the rolling "latest Flash" alias, then to a long-lived Flash model.
const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash']

let workingModel = null

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
 * object, or null if the model output could not be used.
 */
export async function generateStructured({ system, messages, schema, maxOutputTokens = 2048, temperature = 0.4 }) {
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
      const text = response.text
      if (!text) return null
      const parsed = schema.safeParse(JSON.parse(text))
      if (!parsed.success) {
        console.warn(`[gemini] ${model} returned JSON that failed validation`, parsed.error.issues.slice(0, 3))
        return null
      }
      return parsed.data
    } catch (error) {
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
