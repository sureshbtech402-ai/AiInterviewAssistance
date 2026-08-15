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

SPOKEN ANSWER RULES:
1. If the question is asking "WHY", "HOW", or a SPECIFIC follow-up (e.g., "why it is not thread safe?"):
   - DO NOT re-define or explain the whole concept from scratch.
   - Answer DIRECTLY in 2 to 3 spoken sentences:
     Example: "**HashMap** is not thread-safe because its internal methods like **put()** and **get()** are not **synchronized**. If multiple threads modify it concurrently during rehashing, it causes **race conditions** or data inconsistency. In multi-threaded environments, we use **ConcurrentHashMap**."

2. If the question is asking a TOP-LEVEL concept (e.g., "What is HashMap?"):
   - Sentence 1: Direct spoken definition + core property with key terms highlighted in bold.
   - Sentence 2: Internal mechanism or key characteristic.
   - Sentence 3: Practical real-time usage in project/testing.
   - Example: "**HashMap** is basically a key-value collection in Java that implements the **Map** interface with average **O(1)** lookup. Internally, it uses **hashing and bucket arrays** to store entries. In our project, we use it for maintaining in-memory caches and test data, while preferring **ConcurrentHashMap** for thread safety."

3. Style:
   - Highlight 3 to 6 key technical terms, methods, or complexities in bold (**keyword**).
   - Keep answers natural, spoken, and concise (under 55 words).
   - Return ONLY the spoken response.
`.trim();
}