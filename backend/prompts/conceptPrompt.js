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
Answer this concept question like an experienced Indian developer explaining it simply and clearly in an interview.

SPOKEN FLOW:
- Start directly with conversational tech phrasing ("Basically...", "In simple terms...", "Under the hood...", "The main reason is...").
- Focus on practical mechanics:
  - For **HashMap**: Explain array of buckets, computing index via **hashCode()**, chaining on collision, and Java 8 **Red-Black Tree** conversion after threshold 8 for **O(log n)** lookup, with average **O(1)** time.
  - For **Thread Safety**: State directly that methods are unsynchronized, leading to race conditions or infinite loops during rehashing under concurrent writes, and point to **ConcurrentHashMap** (bucket/segment locking).
- Keep it to 3–5 spoken sentences.
- Avoid academic dictionary definitions.

Start directly with the natural spoken answer an Indian IT professional speaking in a live interview.
`.trim();
}