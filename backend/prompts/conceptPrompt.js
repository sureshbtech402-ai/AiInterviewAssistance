import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildConceptPrompt({
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
Answer this technical concept question like an experienced Indian developer explaining it simply, practically, and clearly in an interview.

SPOKEN FLOW:
- Start directly with conversational tech phrasing ("Basically...", "In simple terms...", "Under the hood...", "The main reason is...").
- Explain the under-the-hood mechanics clearly:
  - If asked about data structures (like **HashMap**): Explain bucket arrays, computing index via **hashCode()**, chaining on collision, and tree conversion threshold (Java 8 Red-Black Tree) for **O(log n)** lookup, with average **O(1)** time complexity.
  - If asked about concurrency / thread safety: State clearly why operations are unsynchronized (race conditions, dirty reads, infinite loops during rehashing), and mention thread-safe alternatives (like **ConcurrentHashMap** or locks).
  - For other concepts (e.g., React Hooks, Python GIL, SQL indexing, Microservices): Explain the core purpose, internal working mechanism, and practical advantage in production.
- Keep the response to 3–5 crisp, spoken sentences.
- Avoid academic dictionary definitions or essay-style wrap-ups.

Start directly with the spoken answer.
`.trim();
}