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
Provide a natural, spoken 60-second introduction for an Indian IT professional on a live 1-on-1 interview call.
The candidate will look at the screen and speak this out loud. It must sound completely casual, spontaneous, and conversational.

SPOKEN FLOW (SIMPLE & NATURAL):
1. Greeting & Years of Experience:
   - "Hi, good morning/afternoon, my name is [Name]. Overall I have around [Years] of experience as a [Role], currently working with [Company]."
2. Primary Skills:
   - "Coming to my technical skill set, I mainly work with **[Top 2-3 Skills from Profile]**."
3. Current Project & Daily Work:
   - "In my current project, we are basically working on [Project Domain/Summary from Profile]."
   - "Day-to-day, what I mainly do is [Key Responsibilities from Profile]—like developing features, writing unit tests, and handling API integrations."
4. Award / Achievement (ONLY if present in profile):
   - "Recently, I was also recognized with [Award/Achievement from Profile]."
5. Natural Wrap-up:
   - "Yeah, so that is a quick overview about me and my work."

STRICT RULES:
- Use ONLY facts explicitly present in the Candidate Profile.
- Never invent tools, client names, certifications, or achievements that are not listed in the profile.
- Keep sentences short (10–14 words max) so the candidate speaks with ease and never fumbles.
- Use inline **bold** on only 2–4 primary technical keywords for quick eye-scanning.

Start directly with the spoken introduction.
`.trim();
}