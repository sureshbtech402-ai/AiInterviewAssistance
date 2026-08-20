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
Provide a 60-80 second natural spoken introduction for an Indian IT professional speaking in a live interview.

SPOKEN STRUCTURE:
1. Natural Opening: "Hi, good morning/afternoon, my name is [Name]. Overall I have around [Years] of experience working as a [Role], currently associated with [Company]."
2. Core Tech Stack: "Coming to my technical skill set, my primary focus is on [Top Skills from Profile]."
3. Current Project & Daily Work: "In my current project with [Company/Domain], we are basically developing [Project Domain/Summary]. My day-to-day responsibilities mainly involve [Key Responsibilities from Profile]."
4. Highlight/Award (ONLY if present in profile): "Recently, I also received [Award/Achievement]."
5. Polite Wrap-up: "Yeah, that's pretty much a quick summary about myself. Thank you."

STRICT RULES:
- Use ONLY facts explicitly present in the Candidate Profile.
- Do NOT sound like you are reading a CV or reciting a resume line by line.
- Keep sentences concise, conversational, and direct.
- Highlight 2-4 primary technical keywords with inline markdown **bold**.

Start directly with the spoken introduction.
`.trim();
}