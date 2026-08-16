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
Provide a natural, 160-180 word first-person self-introduction as the candidate in an Indian corporate interview.

SPEECH STRUCTURE:
1. Start directly with: "Hi, I'm [Name], with around [X] years of experience in [Primary Role/Tech]..."
2. Current role & company: Mention current company and main technical stack.
3. Current project & work: Describe hands-on day-to-day work (e.g., framework development, automation, APIs).
4. Previous work/highlight: 1 brief sentence on past experience if present in profile.
5. End cleanly with: "That's a brief overview about my background. Thank you."

STRICT RULES:
- You are an Indian IT professional speaking in a live technical interview, speak naturally, use simple words how indian candiadte will speak in live interview.
- Use ONLY facts explicitly present in the Candidate Profile. Never invent metrics or tools.
- Conversational, spoken phrasing only ("Currently I'm working with...", "My core work involves...", "Basically, we used...").
- NO markdown, NO bullet points, NO headings, and NO filler intros ("Certainly", "Sure").
- Return ONLY the exact spoken words. Start speaking immediately.
`.trim();
}