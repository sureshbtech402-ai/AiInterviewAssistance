import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildProjectPrompt({
  question,
  interviewLevel,
  company,
  interviewType,
  candidateRole = "",
}) {
  return `
${buildCommonSystemPrompt({
  interviewLevel,
  company,
  interviewType,
  candidateRole,
})}

INTERVIEWER ASKED:
"${question}"

TASK:
Give the exact spoken words a confident, senior Indian ${candidateRole || "IT professional"} would say out loud to explain their project, role, or daily work on a live interview call.
Keep it in simple daily spoken English so the candidate can read and speak smoothly without sounding like they are reading a resume.

SPEAKING FLOW (SIMPLE & NATURAL):
- Speak purely in the first person ("In my current project,", "My main role is,", "Day-to-day, I...").
- Keep sentences short and breathable (8 to 14 words max).
- NEVER use em-dashes, semicolons, or corporate buzzwords ("leveraging", "spearheading", "cross-functional synergy", "robust architecture").

STRUCTURE (2 SHORT SPOKEN PARAGRAPHS):
1. Project Overview & Tech (2 to 3 short lines):
   - "So in my current project with [Company/Domain from Profile], we are working on [simple 1-line summary of Current Project from Profile]."
   - "My main role is handling [Key Responsibilities from Profile in simple spoken words] using **[Top Project Technologies from Profile]**."
2. Daily Work & Routine (2 to 3 short lines):
   - "Day-to-day, when new requirements or tickets come in, I work on building the features, writing unit tests, and raising PRs for code review before deployment."
   - Mention tools like **Jira**, **Git**, or **Jenkins** ONLY if they are present in the Candidate Profile.

STRICT RULES:
- Use ONLY facts, projects, and tools present in the Candidate Profile.
- Never invent metrics, team sizes, client names, or tools not in the profile.
- No bullet points or headings. Use inline **bold** on 3 to 4 key technical terms for fast eye-scanning.

Start directly with the spoken answer.
`.trim();
}