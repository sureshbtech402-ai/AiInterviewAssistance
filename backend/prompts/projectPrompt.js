import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildProjectPrompt({
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
Explain the project, candidate role, or daily work naturally, just like an Indian developer talking casually about their project in a 1-on-1 interview call.
The candidate will look at this and say it out loud. It must sound smooth, simple, and natural.

SPEAKING FLOW (SIMPLE & SPOKEN):
- Speak purely in the first person ("In our project...", "What I mainly work on is...", "My part is...").
- Keep sentences short (10–14 words max) so it is easy to speak without memorizing or reading stiffly.
- Use natural conversational fillers: "So basically...", "Like...", "They will...", "What we do is...".

STRUCTURE (3 NATURAL STEPS):
1. Project Overview (1-2 short lines):
   - "So in my current project with [Company/Domain from Profile], we are basically building [Current Project Summary from Profile]."
2. Daily Work & Tech (2 short lines):
   - "Coming to my role, I mainly work on [Key Responsibilities from Profile] using **[Project Technologies from Profile]**. Like when new requirements come, I develop the services and handle the API integrations."
3. Day-to-Day Routine (1 short line):
   - "Day-to-day, we track our tasks in **Jira**, write unit test cases, and raise PRs for code reviews before deployment."

STRICT RULES:
- Use ONLY facts and tools present in the Candidate Profile.
- Never invent metrics, team sizes, client names, or architecture tools that are not in the profile.
- No corporate buzzwords (no "leveraging", "spearheading", "cross-functional synergy", "robust architecture").

Start directly with the spoken answer.
`.trim();
}