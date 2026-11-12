// Shared helpers for describing the patient context to the voice agent,
// the text-chat route and the report route. Plain JS so it can be imported
// from both client components and route handlers.

export const REPORT_READY_PHRASE = 'I have enough to generate your report.'

const MAX_MESSAGES = 60
const MAX_CHARS = 2000

export function describePatient(intake = {}) {
  const lines = []
  lines.push(`Age: ${intake.age || 'not given'}`)
  lines.push(`Biological sex: ${intake.biologicalSex || 'not given'}`)
  if (intake.painOnset) lines.push(`How the pain started: ${intake.painOnset}`)
  if (intake.chronicConditions) lines.push(`Chronic conditions: ${intake.chronicConditions}`)
  if (intake.medications) lines.push(`Current medications: ${intake.medications}`)
  return lines.join('\n')
}

export function describeRegions(painPoints = []) {
  const names = painPoints.map((p) => p.region).filter(Boolean)
  return names.length ? names.join(', ') : 'none selected'
}

export function interviewerPrompt(intake, painPoints) {
  return `You are the voice intake assistant for FindMyPain. You help a patient describe their pain clearly before a doctor's appointment. You are warm and calm, like a knowledgeable friend, never clinical or robotic.

Patient details from the intake form:
${describePatient(intake)}

Pain regions the patient marked on the body model: ${describeRegions(painPoints)}

How to run the conversation:
- Ask one short question at a time, the way a doctor taking a history would. Keep every reply to one or two short sentences, since it is spoken aloud.
- For the marked regions, find out: when it started, what it feels like (sharp, dull, burning, throbbing...), severity from 0 to 10, whether it spreads anywhere, what makes it better or worse, and any other symptoms (numbness, tingling, swelling, fever, nausea). If several regions are marked, ask whether they are related and cover each briefly.
- Acknowledge what the patient says before moving on, but do not repeat it all back.
- Never diagnose and never suggest treatments or medication doses. If asked, say a doctor is the right person to answer and that the report will help them.
- If the patient describes chest pain with shortness of breath, sudden severe headache, weakness or numbness on one side, fainting, or heavy bleeding, tell them calmly to seek emergency care now.
- Once you have covered the main points (usually 5 to 7 questions), or the patient says they are done, end your reply with exactly: "${REPORT_READY_PHRASE}"`
}

// Keep only well-formed user/assistant turns and cap their size, so a client
// cannot push arbitrarily large payloads through to the model.
export function sanitizeHistory(history) {
  if (!Array.isArray(history)) return []
  return history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .filter((m) => m.content.trim())
    .slice(-MAX_MESSAGES)
}

export function sanitizeIntake(intake) {
  const s = (v) => (typeof v === 'string' ? v.slice(0, 200) : v == null ? '' : String(v).slice(0, 200))
  intake = intake || {}
  return {
    age: s(intake.age),
    biologicalSex: s(intake.biologicalSex),
    painOnset: s(intake.painOnset),
    chronicConditions: s(intake.chronicConditions),
    medications: s(intake.medications),
  }
}

export function sanitizePainPoints(painPoints) {
  if (!Array.isArray(painPoints)) return []
  return painPoints
    .filter((p) => p && typeof p.region === 'string')
    .slice(0, 20)
    .map((p) => ({ region: p.region.slice(0, 80) }))
}

const RED_FLAGS = [
  'chest pain', 'chest tightness', 'shortness of breath', "can't breathe", 'cannot breathe',
  'faint', 'passed out', 'stroke', 'worst headache', 'severe headache', 'sudden headache',
  'numb', 'weakness', 'slurred', 'bleeding', 'blood in', 'coughing blood', 'vomiting blood',
  'lost control of', 'bladder', 'bowel control', 'high fever', 'suicid',
]

const NEGATION = /\b(no|not|without|never|denies|don't|dont|do not|haven't|havent|isn't|any)\b(?:(?!\bbut\b)[^.!?,;]){0,25}$/

// Keyword scan used only when Claude is unavailable. Skips mentions that are
// negated just before the keyword ("no numbness", "I don't have chest pain").
export function findRedFlags(history) {
  const text = history.filter((m) => m.role === 'user').map((m) => m.content.toLowerCase()).join(' \n ')
  return RED_FLAGS.filter((flag) => {
    let i = text.indexOf(flag)
    while (i !== -1) {
      if (!NEGATION.test(text.slice(Math.max(0, i - 40), i))) return true
      i = text.indexOf(flag, i + flag.length)
    }
    return false
  })
}
