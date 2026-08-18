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
1. Warm, natural start: "Hi, good morning/afternoon, my name is [Name]. Overall I have around [Years] of experience as a [Role], currently working with [Company]."
2. Primary skill set: "Coming to my core tech stack, I primarily work on [Top Skills from Profile]."
3. Current project snapshot: "In my current project, we are developing [Project Domain/Summary]. Basically, my day-to-day work involves [Key Responsibilities from Profile]."
4. Achievement (only if present in profile): "Recently, I also received [Award/Achievement]."
5. Short, natural wrap-up: "Yeah, that's all about my self. Thank you"

STRICT RULES:
- Use ONLY facts explicitly in the Candidate Profile.
- Do NOT sound like you are reading a CV or listing every single skill.
- Keep sentences short, punchy, and conversational.

Start directly with the natural spoken introduction for an Indian IT professional speaking in a live interview.
`.trim();
}