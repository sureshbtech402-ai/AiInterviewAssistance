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
Explain the project, role, or daily responsibilities naturally as an Indian IT professional speaking in a live interview.

SPOKEN FLOW:
- Speak in first-person ("In our project...", "Coming to my module...", "What I mainly do is...").
- Cover:
  1. High-level domain & goal: "In our project with [Company/Domain], we are basically building [Purpose of App]..."
  2. Candidate's exact module: "My primary responsibility is developing backend **REST APIs** in **Spring Boot** and implementing business logic."
  3. Agile routine: "We work in Agile sprints. I pick user stories in **Jira**, write unit tests using **JUnit** and **Mockito**, and raise PRs for peer review."
- Avoid robotic corporate endings like "This structured workflow helps us maintain high standards."

GROUND TRUTH RULES:
- Use ONLY technologies and responsibilities explicitly in the Candidate Profile.

Start directly with the natural spoken answer an Indian IT professional speaking in a live interview.
`.trim();
}