import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildScenarioPrompt({
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
Answer this scenario/troubleshooting question in 3 to 5 natural, spoken sentences as the candidate in an Indian corporate interview.

SPEECH STRUCTURE:
- Direct approach: Start directly with what you would do ("First, I would check...", "In this situation, I would start by inspecting...").
- Practical step: Mention 1-2 core troubleshooting actions (e.g., checking application logs, reproducing the issue, verifying recent changes).
- Resolution: Explain how you would isolate the root cause and validate the fix.
- If it is about personal project experience, stick strictly to the Candidate Profile. If hypothetical, state how you would approach it practically without pretending to have experienced that exact production incident.

STRICT RULES:
- First-person spoken phrasing only ("In my experience...", "I usually...", "Basically, we would...").
- Keep it under 60 words so it can be spoken in 20-30 seconds.
- NO bullet points, NO headings, NO markdown, NO textbook definitions.
- Return ONLY the exact spoken words. Start speaking immediately.
`.trim();
}