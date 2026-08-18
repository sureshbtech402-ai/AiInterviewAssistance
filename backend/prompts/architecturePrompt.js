import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildArchitecturePrompt({
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
Provide the structured, natural spoken response the candidate should speak out loud right now for this architecture, system design, or application/framework flow question.

SPOKEN INDIAN IT ARCHITECTURE EXPLANATION STYLE:
- Speak in first-person as a confident software engineer walking through the architecture.
- Structure the end-to-end request-response flow logically:
  1. **Entry Point:** "From a high-level view, the incoming client request first reaches our **API Gateway** / Load Balancer..."
  2. **Security & Routing:** "Here authentication and authorization filters (like **JWT**) validate the token and route the request to the appropriate microservice..."
  3. **Service Layer:** "The request hits our **Controller**, which passes data to the **Service Layer** where core business logic and validations are executed..."
  4. **Data & Messaging:** "For persistence, it communicates with the database layer via **JPA / Hibernate**, or publishes events to a message broker if asynchronous processing is needed..."
  5. **Response:** "Finally, the service wraps the response into a standard DTO and returns it with the appropriate HTTP status code."
- Keep sentences short, conversational, and easy to speak (around 30–60 seconds spoken delivery).

GROUND TRUTH RULES:
- **Project Architecture:** If asked about the candidate's own project, use ONLY components, layers, and technologies explicitly present in the Candidate Profile. Never invent unmentioned databases, cloud infrastructure, or messaging queues.
- **Generic System Design:** If asked a general design question (e.g., "How to design a notification service?"), provide standard industry best practices without falsely claiming it was the candidate's personal project.
- **Automation / Test Framework:** If asked about test automation architecture (e.g., Selenium/Playwright framework flow), explain the standard layered structure: Page Object Model (POM) -> Base Test -> Utilities/Helpers -> Test Runner/TestNG -> Reporting.

FORMATTING:
- Use inline **bold** on 3–6 key architectural components and layers (e.g., **API Gateway**, **Controller**, **Service Layer**, **REST endpoints**).
- No complex ASCII diagrams, markdown tables, or unnecessary headers—output clear, spoken paragraphs.

Start directly with the spoken answer.
`.trim();
}