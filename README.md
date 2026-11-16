# FindMyPain

FindMyPain helps people describe their pain and prepare for a doctor's appointment. It combines an interactive body map with a guided conversation, turning symptoms into a clear report to share with a clinician.

## What it does

- Collects basic health context, including when the pain began, existing conditions, and medications.
- Lets users mark painful areas on a rotatable 3D body.
- Asks follow-up questions through text or voice about severity, sensation, triggers, and related symptoms.
- Produces a downloadable PDF with a symptom summary, details by body region, warning signs mentioned, and questions to ask a doctor.

## Why it exists

Pain can be difficult to explain, especially during a short appointment. FindMyPain helps users organize what they are experiencing beforehand, so they can bring a clearer account to the conversation with their clinician. It supports communication and appointment preparation; it does not provide a diagnosis.

## How it works

The web app uses Next.js and React, with Three.js and React Three Fiber for the body map. Selected regions and intake answers give context to the interview. Vapi handles voice conversations, while server-side Gemini calls power text interviews and turn the conversation into a structured report.

Responses are validated against a defined schema, and scripted questions and a basic summary provide fallbacks when Gemini is unavailable. The PDF is generated in the browser with React PDF.
