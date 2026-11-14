import { z } from 'zod'
import { generateStructured, hasGemini, failureReason } from '@/lib/gemini'
import {
  interviewerPrompt, sanitizeHistory, sanitizeIntake, sanitizePainPoints,
  describeRegions, findRedFlags, REPORT_READY_PHRASE,
} from '@/lib/intake'

// Text-mode counterpart of the voice agent: same interviewer prompt, used when
// the microphone is unavailable or the patient prefers typing.

export const maxDuration = 60

const ReplySchema = z.object({
  reply: z.string().describe('What the assistant says next: one or two short sentences.'),
  readyForReport: z.boolean().describe('True once enough detail has been gathered and the reply ends the interview.'),
})

const SCRIPTED = [
  (regions) => `Let's talk about your ${regions}. When did this pain start?`,
  () => 'How would you describe the pain: sharp, dull, burning, throbbing, or something else?',
  () => 'On a scale from 0 to 10, how bad is it right now, and at its worst?',
  () => 'Does the pain spread or move anywhere else?',
  () => 'What makes it better or worse, for example movement, rest, or certain positions?',
  () => 'Have you noticed anything else with it, such as numbness, tingling, swelling, fever, or nausea?',
]

function scriptedReply(history, painPoints) {
  const asked = history.filter((m) => m.role === 'assistant').length
  if (findRedFlags(history.slice(-1)).length) {
    return {
      reply: 'Some of what you described can be serious. If it is severe, sudden, or getting worse, please seek emergency care now. ' +
        (asked < SCRIPTED.length ? SCRIPTED[Math.min(asked, SCRIPTED.length - 1)](describeRegions(painPoints)) : REPORT_READY_PHRASE),
      readyForReport: asked >= SCRIPTED.length,
    }
  }
  if (asked < SCRIPTED.length) {
    return { reply: SCRIPTED[asked](describeRegions(painPoints)), readyForReport: false }
  }
  return { reply: `Thank you, that's really helpful. ${REPORT_READY_PHRASE}`, readyForReport: true }
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const intake = sanitizeIntake(body.intake)
  const painPoints = sanitizePainPoints(body.painPoints)
  const history = sanitizeHistory(body.history)

  if (!hasGemini()) {
    return Response.json({ ...scriptedReply(history, painPoints), source: 'scripted', reason: 'GEMINI_API_KEY not set' })
  }

  // The model needs a user turn first; the opening question has none yet.
  const messages = [
    { role: 'user', content: '[The patient has opened the chat. Greet them briefly and ask your first question.]' },
    ...history,
  ]
  // A typed reply to the last assistant turn may be missing; never end on assistant.
  if (messages[messages.length - 1].role === 'assistant') {
    messages.push({ role: 'user', content: '[The patient has not replied yet. Ask your next question.]' })
  }

  try {
    const result = await generateStructured({
      system: interviewerPrompt(intake, painPoints),
      messages,
      schema: ReplySchema,
    })
    return Response.json({ ...result, source: 'gemini' })
  } catch (error) {
    const reason = failureReason(error)
    console.error('[api/chat] Gemini failed:', reason)
    return Response.json({ ...scriptedReply(history, painPoints), source: 'scripted', reason })
  }
}
