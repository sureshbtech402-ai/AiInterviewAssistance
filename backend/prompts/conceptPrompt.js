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
Give the exact spoken explanation the candidate should speak out loud to the interviewer right now.

SPOKEN INDIAN IT STYLE & FLOW:
- Speak directly in first-person with natural spoken Indian IT phrasing ("Basically...", "In simple terms...", "Under the hood...", "The main reason is...").
- Explain the under-the-hood mechanism clearly so the interviewer is completely satisfied:
  - For **HashMap**: Explain that it works on an array of Node buckets. When we put an entry, it calculates **hashCode()** to find the bucket index. If collisions occur, it chains elements in a linked list, and from Java 8 onwards, if collisions exceed 8, it converts to a **Tree (Red-Black Tree)** to maintain **O(log n)** lookup instead of **O(n)**. Average complexity is **O(1)**.
  - For **Thread Safety**: Explain that methods like **put()** and **get()** are not synchronized, so concurrent modifications can lead to race conditions or infinite loops during rehashing. To handle this in multi-threading, we use **ConcurrentHashMap**, which uses bucket-level locking.
- Keep it concise, punchy, and conversational (3 to 5 spoken sentences).
- Avoid robotic textbook definitions or dictionary-like phrasing.

FORMATTING:
- Use inline **bold** on 2–4 key terms, classes, methods, or complexities (e.g., **hashCode()**, **Red-Black Tree**, **O(1)**, **ConcurrentHashMap**).
- No unnecessary headers, bullets, or intro filler.

Start directly with the spoken answer.
`.trim();
}