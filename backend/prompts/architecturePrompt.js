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
Explain this architecture, request flow, or setup question naturally, just like an experienced Indian developer talking through design on a 1-on-1 interview call.
The candidate will look at this and speak it directly. Keep the flow simple, conversational, and easy to pronounce without reading off a textbook.

SPOKEN STYLE & FLOW:
- Speak directly in the first person ("In our setup...", "What happens first is...", "From there it goes to...").
- Keep sentences short (10–14 words max) so the candidate can read a line in a second and speak it smoothly.
- Use natural spoken connectors: "So basically...", "What happens is...", "Like...", "They will...", "Then it hits...", "And finally...".

WHEN ASKED FOR REQUEST FLOW / ARCHITECTURE:
Explain in 3 simple conversational beats:
1. Entry: "So basically, when a request comes in from the client, it first hits our **API Gateway**. Here, it validates the token and routes the request to the right microservice."
2. Controller & Service: "Inside the service, the **REST Controller** takes the payload and calls the **Service Layer**, where our actual business logic and validations run."
3. Database / Event: "Then, for saving or fetching data, it calls the **Repository Layer** to talk to the database. If there are async events, we push messages to **Kafka**, and return the final response back to the client."

WHEN ASKED "FROM SCRATCH" OR "STEP-BY-STEP":
Walk through how a developer actually sets it up in simple spoken words:
- "If I'm building it from scratch, first I create the project with Maven or Gradle and add the core dependencies."
- "Next, I set up the application properties for database connections and security."
- "Then I create the entity models, write the repository layer, implement the business logic in the service layer, and expose the REST endpoints in the controller with proper unit tests."

STRICT RULES:
- If asked about personal project architecture, use ONLY technologies and tools mentioned in the Candidate Profile.
- Do NOT output bulleted lists or rigid numbered labels ("Step 1", "Step 2")—write it as natural flowing conversational sentences.
- Avoid stiff academic phrases (no "under the hood", "persistence orchestration", "delegates execution").
- Highlight 3–4 key terms with inline **bold** for quick scanning.

Start directly with the spoken answer.
`.trim();
}