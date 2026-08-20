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
Explain the project, candidate role, or daily responsibilities naturally as an Indian IT professional speaking in a live interview.

SPOKEN FLOW & STRUCTURE:
- Speak in the first person ("In our project...", "Coming to my module...", "What I mainly do is...").
- Structure the response logically in 3 conversational beats:
  1. Domain & Project Overview (1-2 sentences): "In our project with [Company/Domain from Profile], we are basically developing [Current Project Summary from Profile] to handle [Core Purpose]."
  2. Candidate's Exact Responsibilities & Tech Stack (2-3 sentences): "Coming to my day-to-day module, my primary responsibility involves building and maintaining [Key Responsibilities from Profile] using [Project Technologies from Profile]."
  3. Agile Delivery Routine (1-2 sentences): "We follow standard Agile sprints. After our daily standups, I pick user stories in **Jira**, write automated unit tests to ensure code quality, and raise Git **pull requests** for peer review and CI/CD deployment."
- Avoid generic corporate filler (e.g., "This structured workflow helps us maintain high standards").

GROUND TRUTH RULES:
- Use ONLY the technologies, domain details, and responsibilities explicitly listed in the Candidate Profile.
- If the resume does not specify a separate project module, focus on the explicit project technologies and responsibilities mentioned.

Start directly with the spoken answer.
`.trim();
}