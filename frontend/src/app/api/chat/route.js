import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import {
  interviewerPrompt, sanitizeHistory, sanitizeIntake, sanitizePainPoints,
  describeRegions, findRedFlags, REPORT_READY_PHRASE,
} from '@/lib/intake'

// Text-mode counterpart of the voice agent: same interviewer prompt, used when
// the microphone is unavailable or the patient prefers typing.

export const maxDuration = 30

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

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ ...scriptedReply(history, painPoints), source: 'scripted' })
  }

  // The Messages API needs a user turn first; the opening question has none yet.
  const messages = [
    { role: 'user', content: '[The patient has opened the chat. Greet them briefly and ask your first question.]' },
    ...history,
  ]
  // A typed reply to the last assistant turn may be missing; never end on assistant.
  if (messages[messages.length - 1].role === 'assistant') {
    messages.push({ role: 'user', content: '[The patient has not replied yet. Ask your next question.]' })
  }

  try {
    const client = new Anthropic()
    const response = await client.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      output_config: { effort: 'low', format: zodOutputFormat(ReplySchema) },
      system: interviewerPrompt(intake, painPoints),
      messages,
    })
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return Response.json({ ...scriptedReply(history, painPoints), source: 'scripted' })
    }
    return Response.json({ ...response.parsed_output, source: 'claude' })
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error('[api/chat] Claude API error', error.status, error.message)
    } else {
      console.error('[api/chat] unexpected error', error)
    }
    return Response.json({ ...scriptedReply(history, painPoints), source: 'scripted' })
  }
}
