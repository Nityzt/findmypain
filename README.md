<div align="center">

# FindMyPain

**Describe your pain. Prepare for your appointment.**

An interactive body map and guided conversation that turn symptoms into a clear report to share with a clinician.

</div>

---

## Why it exists

Pain can be difficult to explain, especially during a short appointment. FindMyPain helps people organize what they are experiencing beforehand, so they can bring a clearer account to their clinician.

## What it does

1. **Share the context** — Record when the pain began, existing conditions, and medications.
2. **Mark the pain** — Select painful areas on a rotatable 3D body.
3. **Talk it through** — Answer questions by text or voice about severity, sensation, triggers, and related symptoms.
4. **Take a report** — Download a PDF with a symptom summary, details by body region, warning signs mentioned, and questions for the doctor.

## How it works

Selected body regions and intake answers guide the interview. The conversation is then organized into a structured report.

| Part | Powered by |
| --- | --- |
| Web experience | Next.js & React |
| Interactive body map | Three.js & React Three Fiber |
| Voice conversations | Vapi |
| Text interviews & report generation | Server-side Gemini calls |
| Downloadable reports | React PDF, generated in the browser |

AI responses are validated against a defined schema. Scripted questions and a basic summary provide fallbacks when Gemini is unavailable.

> **For appointment preparation.** FindMyPain helps communicate symptoms; it does not provide a diagnosis.
