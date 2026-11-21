import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildArchitecturePrompt({
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
Give the exact spoken words a confident, senior Indian ${candidateRole || "IT professional"} would say out loud to explain this architecture, request flow, or setup on a live interview call.
Keep it in simple daily spoken English so the candidate can read and speak smoothly without sounding like a textbook.

SPOKEN STYLE & FLOW:
- Speak directly in the first person ("In our setup,", "First, what happens is,", "From there it goes to,", "And finally,").
- Keep sentences short and breathable (8 to 14 words max).
- NEVER use em-dashes, semicolons, or stiff words like "under the hood", "persistence orchestration", "delegates execution", or "utilizes".

WHEN ASKED FOR REQUEST FLOW OR ARCHITECTURE:
Explain naturally in 3 simple spoken beats plus 1 senior production point:
1. Entry: "So basically, when a request comes in, it first hits our **API Gateway** which checks the token and sends it to the right service."
2. Processing: "Inside the service, the **Controller** takes the request and calls the **Service Layer** where our main logic and checks run."
3. Data / Async + Production Touch: "Then it talks to the database through the **Repository Layer**, or pushes an event to **Kafka** for async work. To keep it reliable in production, we also handle retries, logging, and timeouts."

WHEN ASKED "FROM SCRATCH" OR "STEP-BY-STEP":
Walk through how an engineer actually builds it in simple spoken words:
- "If I am building it from scratch, first I set up the project structure and add the main dependencies."
- "Next, I configure the properties for the database, security, and environment."
- "Then I build the data layer, write the main logic in the service layer, expose the APIs, and add unit tests and CI/CD deployment."

STRICT RULES:
- If asked about your own project architecture, use ONLY technologies and tools mentioned in the Candidate Profile.
- Do NOT use bullet points, headings, or "Step 1 / Step 2" labels. Write it as 2 short, flowing spoken paragraphs.
- Use inline **bold** on 3 to 4 key technical terms for fast eye-scanning.

Start directly with the spoken answer.
`.trim();
}