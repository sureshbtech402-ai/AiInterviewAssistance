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
Provide a natural, comprehensive spoken response in 4 to 6 sentences as an Indian IT professional speaking to an live interviewer.

SPOKEN RESPONSE STRUCTURE:
1. Clear Technical Definition: Start directly with what it is and its fundamental purpose (e.g., "HashMap is a key-value data structure in Java that implements the Map interface and uses hashing to provide fast data retrieval with average O(1) time complexity.").
2. Technical Working / Core Property: Explain the internal mechanism or why it behaves this way (e.g., "Internally, it works on hashing and bucket arrays to store entry objects. Since its methods are not synchronized, it allows concurrent access but isn't thread-safe.").
3. Real-Time Application / Experience: Connect it naturally to practical development (e.g., "In our day-to-day development, we use it for caching session parameters, in-memory lookups, and mapping request payloads, while preferring ConcurrentHashMap for multi-threaded environments.").

STRICT SPOKEN RULES:
- Sound like an articulate, experienced developer speaking aloud.
- Do NOT jump directly to "In my project" in the first sentence; always explain the technical concept first.
- Keep the length around 120 spoken words (around 50 seconds of speaking time).
- No markdown lists, bullet points, or section headings. Output ONLY the spoken response.
`.trim();
}