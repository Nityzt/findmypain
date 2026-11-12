import { z } from 'zod'
import { generateStructured, hasGemini } from '@/lib/gemini'
import {
  describePatient, describeRegions, sanitizeHistory, sanitizeIntake,
  sanitizePainPoints, findRedFlags,
} from '@/lib/intake'

// Turns the intake form, marked regions and the conversation transcript into
// the structured summary shown on the report screen and in the PDF.

export const maxDuration = 60

const NOT_MENTIONED = 'Not mentioned'

const RegionSchema = z.object({
  region: z.string(),
  onset: z.string().describe('When and how it started, in plain words.'),
  character: z.string().describe('What the pain feels like.'),
  severity: z.string().describe('Severity as the patient gave it, e.g. "6/10, 8/10 at worst".'),
  radiation: z.string().describe('Where it spreads, if anywhere.'),
  aggravating: z.string().describe('What makes it worse.'),
  relieving: z.string().describe('What makes it better.'),
  associated: z.string().describe('Other symptoms that come with it.'),
})

const ReportSchema = z.object({
  urgency: z.enum(['low', 'moderate', 'high']),
  urgencyReason: z.string().describe('One sentence explaining the urgency level.'),
  summary: z.string().describe('A 2-4 sentence clinical-style summary a doctor can read in ten seconds.'),
  regions: z.array(RegionSchema),
  redFlags: z.array(z.string()).describe('Warning signs the patient mentioned; empty if none.'),
  considerations: z.array(z.string()).describe('2-4 broad possibilities for the clinician to consider, phrased as possibilities, never as a diagnosis.'),
  questionsForDoctor: z.array(z.string()).describe('3-5 questions the patient could ask at the appointment.'),
  nextSteps: z.array(z.string()).describe('2-4 general, safe next steps such as when to book an appointment and what to track.'),
})

const SYSTEM = `You prepare a pre-appointment pain summary for FindMyPain. A patient marked painful regions on a body model and answered an intake interview. Write for the clinician who will see them.

Rules:
- Only report what the patient actually said. When something was not discussed, write "${NOT_MENTIONED}". Do not invent details.
- Produce one entry in "regions" for every marked region, in the order given, using the region names exactly as given. Add a region only if the patient clearly described pain somewhere else.
- Never give a diagnosis, medication names or doses. Considerations are broad categories for a clinician to evaluate.
- Urgency: "high" if there are red-flag symptoms (for example chest pain with breathlessness, sudden severe headache, one-sided weakness or numbness, fainting, heavy bleeding, loss of bladder or bowel control, high fever with severe pain); "moderate" for significant, worsening or persistent pain that should be seen soon; otherwise "low".`

function fallbackReport(intake, painPoints, history) {
  const flags = findRedFlags(history)
  const patientWords = history.filter((m) => m.role === 'user').map((m) => m.content.trim()).filter(Boolean)
  const regions = painPoints.map((p) => ({
    region: p.region, onset: intake.painOnset || NOT_MENTIONED, character: NOT_MENTIONED,
    severity: NOT_MENTIONED, radiation: NOT_MENTIONED, aggravating: NOT_MENTIONED,
    relieving: NOT_MENTIONED, associated: NOT_MENTIONED,
  }))
  return {
    urgency: flags.length ? 'high' : painPoints.length ? 'moderate' : 'low',
    urgencyReason: flags.length
      ? 'The patient mentioned symptoms that can be warning signs and should be assessed promptly.'
      : 'Based on the information available; a clinician should review the details below.',
    summary: `Patient reports pain in: ${describeRegions(painPoints)}.` +
      (patientWords.length ? ` In their own words: "${patientWords.join(' / ').slice(0, 600)}"` : ''),
    regions,
    redFlags: flags.map((f) => `Mentioned "${f}"`),
    considerations: ['A clinician should assess these symptoms in person.'],
    questionsForDoctor: [
      'What could be causing this pain?',
      'Do I need any tests or imaging?',
      'What should I do if it gets worse?',
    ],
    nextSteps: flags.length
      ? ['Seek urgent medical care if symptoms are severe, sudden, or worsening.', 'Bring this report to the clinician.']
      : ['Book an appointment with a clinician if the pain persists or worsens.', 'Keep a note of severity, triggers and what helps.'],
  }
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

  if (!hasGemini() || history.length === 0) {
    return Response.json({ report: fallbackReport(intake, painPoints, history), source: 'fallback' })
  }

  const transcript = history
    .map((m) => `${m.role === 'user' ? 'PATIENT' : 'ASSISTANT'}: ${m.content}`)
    .join('\n')

  try {
    const report = await generateStructured({
      system: SYSTEM,
      schema: ReportSchema,
      maxOutputTokens: 4096,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: `<intake>\n${describePatient(intake)}\n</intake>\n\n<marked_regions>\n${describeRegions(painPoints)}\n</marked_regions>\n\n<transcript>\n${transcript}\n</transcript>`,
      }],
    })
    if (!report) {
      return Response.json({ report: fallbackReport(intake, painPoints, history), source: 'fallback' })
    }
    return Response.json({ report, source: 'gemini' })
  } catch (error) {
    console.error('[api/report] Gemini error', error?.status ?? '', error?.message ?? error)
    return Response.json({ report: fallbackReport(intake, painPoints, history), source: 'fallback' })
  }
}
