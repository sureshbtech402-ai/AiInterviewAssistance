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
Provide the exact, natural spoken explanation the candidate should speak out loud for this architecture, system design, request flow, or "from scratch" setup question.

SPOKEN INDIAN IT ARCHITECTURE FLOW:
- Speak in the first person as an experienced engineer explaining the setup simply, practically, and logically.
- Use natural spoken connectors: "From a high-level view...", "Basically, the flow starts when...", "From there, it hits...", "Under the hood...".

WHEN ASKED "FROM SCRATCH" OR "STEP-BY-STEP":
Walk through the actual chronological developer steps:
- "Step 1: Setup & Dependencies (using build tools like Maven/Gradle, npm, or starters to pull core dependencies)..."
- "Step 2: Configuration & Environment (setting up application properties, database connection pools, security configs, and environment variables)..."
- "Step 3: Domain & Entity Layer (defining data schemas, models, and entities)..."
- "Step 4: Persistence/Repository Layer (implementing data access interfaces and queries)..."
- "Step 5: Business Service Layer (implementing core business logic, validations, and custom exception handling)..."
- "Step 6: API / Controller Layer (exposing endpoints, handling request mappings, DTO validations, and HTTP response codes)..."
- "Step 7: Testing & CI/CD (writing unit/integration tests and configuring automated deployment pipelines)."

FOR GENERAL ARCHITECTURE & REQUEST FLOW:
Structure the explanation into 2–3 conversational paragraphs:
1. Entry Point & Routing: "From a high-level view, the incoming client request first hits our **API Gateway** / Load Balancer. Here, token validation and security checks happen before routing to the appropriate microservice."
2. Service & Business Layer: "Inside the microservice, the request enters the **REST Controller**, which validates the payload and delegates execution to our **Service Layer** for business logic processing."
3. Data & Messaging: "For persistence, it communicates with the database layer (via **ORM/Repositories**), or publishes events to a message broker (like **Kafka/RabbitMQ**) for asynchronous flows. Finally, the result is wrapped into a clean DTO and returned."

GROUND TRUTH RULES:
- **Project Architecture:** For personal project questions, use ONLY technologies, databases, and message brokers explicitly present in the Candidate Profile.
- **Generic System Design:** For generic design questions (e.g., URL shortener, Rate limiter), explain solid architectural patterns without pretending it was a personal company project.
- **QA Automation Frameworks:** Explain the layered model: Page Object Model -> Base Test & Drivers -> Utilities -> Test Runners (TestNG / Cucumber) -> Reporting (Extent/Allure).

FORMATTING:
- Lightly **bold** 3–5 key architectural terms (e.g., **API Gateway**, **REST Controller**, **Service Layer**, **Microservices**).
- No diagrams or formal essay wrap-ups.

Start directly with the spoken answer.
`.trim();
}