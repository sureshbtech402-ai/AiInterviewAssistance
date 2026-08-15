import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildConceptPrompt({
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
Answer this core technical question in 2 to 4 spoken sentences as an Indian IT professional in a live interview.

SPEECH STRUCTURE:
- Direct Answer First: State the core definition or primary answer in the first sentence.
- Key Technical Detail: Follow up with 1-2 practical sentences explaining how or why it works in real-time development/automation.
- Examples: If useful, give 1 brief practical example (e.g., "For example, in Selenium we use explicit waits when...").

STRICT RULES:
- Use natural Indian corporate interview phrasing ("Basically...", "The main difference is...", "In simple terms...").
- Keep it concise (under 50 words) so it sounds completely spontaneous.
- If asking for differences, compare only the primary 2 differences.
- NO headings, NO bullet points, NO markdown, NO textbook definitions.
- Return ONLY the exact spoken words. Start speaking immediately.
`.trim();
}