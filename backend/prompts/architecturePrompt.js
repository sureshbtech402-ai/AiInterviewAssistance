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
Provide the exact, natural spoken explanation the candidate should speak out loud for this architecture, system design, or request flow question.

SPOKEN INDIAN IT ARCHITECTURE FLOW:
- Speak in first-person as an experienced engineer explaining the setup simply and logically.
- Use natural spoken transitions: "From a high-level view...", "Basically, the flow starts when...", "From there, it hits...", "Under the hood...".
- Structure the end-to-end flow cleanly in 2–3 short spoken paragraphs:
  1. **Entry Point & Routing:** "From a high-level view, the incoming client request first hits our **API Gateway** / Load Balancer. Here, authentication and token validation happen, and it routes the call to the appropriate microservice."
  2. **Service & Business Layer:** "Inside our microservice, the request enters the **REST Controller**, which delegates it to the **Service Layer** for validations and business logic execution."
  3. **Data & Messaging:** "For persistence, it communicates with the database via **Spring Data JPA / Hibernate**, or publishes an event to **Kafka** if asynchronous processing is needed. Finally, the service wraps the response into a DTO and returns it."

GROUND TRUTH RULES:
- **Project Architecture:** If asked about the candidate's own project, use ONLY technologies, databases, and message brokers explicitly present in the Candidate Profile.
- **Generic System Design:** If asked a generic design question (e.g., "Design URL shortener" or "How to design a scalable system"), explain solid architectural best practices without pretending it was a personal project.
- **Automation / QA Framework:** If asked about test framework architecture (Selenium / BDD), explain the standard layered model: Page Object Model -> Base Test -> Utility Helpers -> TestNG / Cucumber Runner -> Reports.

FORMATTING:
- Lightly **bold** 3–5 key architectural terms (e.g., **API Gateway**, **REST Controller**, **Service Layer**, **Microservices**).
- No diagrams, bullet points, or formal essay wrap-ups.

Start directly with the natural spoken answer an Indian IT professional speaking in a live interview.
`.trim();
}