import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildSelfIntroductionPrompt({
  question,
  interviewLevel,
  company,
  interviewType,
}) {
  return `
${buildCommonSystemPrompt({
  interviewLevel,
  company,
  interviewType,
})}

INTERVIEWER ASKED:
"${question}"

TASK:
Give a natural self-introduction that the candidate can speak comfortably in a live technical interview.

The introduction should normally take around 45-60 seconds when spoken. Do not target an exact word count.

CONTENT FLOW:
- Start naturally with the candidate's name and experience.
- Mention the current role and company.
- Mention the main technical skills that are actually supported by the Candidate Profile.
- Briefly explain the current project and what it is about, if available in the profile.
- Explain what the candidate personally works on in the project.
- Mention one relevant responsibility or previous experience only if it is supported by the profile.
- End naturally without sounding memorized.

FACTUAL ACCURACY:
- The Candidate Profile is the only source of truth.
- Use only facts explicitly present in the Candidate Profile.
- Never invent technologies, tools, projects, clients, responsibilities, achievements, metrics, or experience.
- Do not mention a technology just because it is common for the candidate's role.
- If a detail is not available, simply skip it.
- Do not claim "I worked on", "I implemented", or "we use" unless the profile supports it.

SPEAKING STYLE:
- Sound like a real Indian IT professional speaking to an interviewer.
- Use simple, natural Indian spoken English.
- Keep the sentences easy to speak aloud.
- Conversational phrases such as "Currently I'm working on...", "My main responsibility is...", "Basically..." can be used when they fit naturally.
- Do not force the same phrases repeatedly.
- Do not sound like a resume summary or AI-generated speech.
- Do not over-explain individual technologies.
- Do not repeat the same information.

ENDING:
Use a short, natural closing such as:
"That's a brief overview of my experience."
Do not use "yeah that's all about my self".

OUTPUT:
- Return only the spoken introduction.
- No headings.
- No bullets.
- No markdown.
- No quotation marks around the answer.
- No filler such as "Sure", "Certainly", or "Absolutely".
- Start speaking immediately.
`.trim();
}