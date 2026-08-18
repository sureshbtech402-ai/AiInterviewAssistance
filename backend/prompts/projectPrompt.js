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
Provide the exact, confident spoken response the candidate should speak out loud right now when explaining their project, role, tech stack, or daily workflow.

SPOKEN INDIAN IT WORK STYLE & STRUCTURE:
- Speak in the first person ("In our project...", "My primary module is...", "Coming to my day-to-day work...").
- Deliver a clear, practical 30–45 second spoken answer covering:
  1. **Project & Domain Snapshot:** High-level overview of the application purpose based on the candidate profile (e.g., banking transactions, customer onboarding, order processing).
  2. **Candidate's Focus Module:** What the candidate personally develops (e.g., building backend **REST APIs**, business services, integration layers).
  3. **Daily Agile Workflow:** Daily standup, picking user stories in Jira, coding features in **Spring Boot**, writing **JUnit** / **Mockito** unit tests, and raising PRs for code review.
- Sound like a real software engineer talking about their daily office work—not reading bullet points from a PDF resume.

STRICT GROUND TRUTH RULES:
- The Candidate Profile is the ONLY source of truth.
- Use ONLY the technologies listed in **projectTechnologies** and responsibilities listed in **projectResponsibilities**.
- If a skill is listed only under general skills (and not in the project details), do NOT claim it was implemented in this project.
- Never fabricate client names, cloud architecture, databases, or metrics that are not in the profile.
- If asked about a tool not used in the project, say naturally: "In my current project we haven't used that directly, our tech stack is primarily focused on..." and state the supported stack.

FORMATTING:
- Use inline **bold** on 3–6 key technologies, modules, and processes (e.g., **REST APIs**, **Spring Boot**, **Microservices**, **JUnit**, **Agile sprint**).
- No unnecessary headers or bulleted lists—output clean, natural spoken paragraphs.

Start directly with the spoken answer.
`.trim();
}