// TEMPORARY diagnostics: times each candidate Gemini model. Remove after debugging.
import { GoogleGenAI } from '@google/genai'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite']

async function timed(fn) {
  const t = Date.now()
  try {
    const r = await fn()
    return { ok: true, ms: Date.now() - t, text: (r.text || '').slice(0, 60), finish: r.candidates?.[0]?.finishReason, usage: r.usageMetadata }
  } catch (e) {
    let msg = e?.message || String(e)
    try { msg = JSON.parse(msg)?.error?.message ?? msg } catch { /* plain */ }
    return { ok: false, ms: Date.now() - t, status: e?.status, error: msg.slice(0, 160) }
  }
}

export async function GET() {
  if (!process.env.GEMINI_API_KEY) return Response.json({ error: 'GEMINI_API_KEY not set' })
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const envModel = process.env.GEMINI_MODEL || null
  const models = [...new Set([envModel, ...MODELS].filter(Boolean))]
  const results = await Promise.all(models.map(async (model) => ({
    model,
    plain: await timed(() => ai.models.generateContent({
      model, contents: 'Reply with the single word OK.',
      config: { maxOutputTokens: 256, httpOptions: { timeout: 25000 } },
    })),
    jsonLow: await timed(() => ai.models.generateContent({
      model, contents: 'Ask a patient with knee pain when it started.',
      config: {
        maxOutputTokens: 2048, responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object', properties: { reply: { type: 'string' } }, required: ['reply'] },
        thinkingConfig: { thinkingLevel: 'LOW' }, httpOptions: { timeout: 25000 },
      },
    })),
  })))
  return Response.json({ envModel, results })
}
