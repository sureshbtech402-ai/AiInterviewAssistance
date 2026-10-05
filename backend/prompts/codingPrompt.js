import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildCodingPrompt({
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
Provide the optimal code first. Then give a simple spoken walkthrough that the candidate can read and say naturally on the call.
If the interviewer ALSO asked an additional theory question in the same prompt, answer that theory question directly after the code.

CODE RULES:
- Start directly with the code inside a Markdown block (\`\`\`java, \`\`\`python, \`\`\`sql).
- Write clean, optimal code with basic null/empty checks at the start.
- No intro text before the code block.

SPOKEN EXPLANATION (BELOW CODE):
Keep it short, simple, and conversational (words like "So basically", "Like", "What we do is", "They will").

1. Logic (2–3 short lines):
   - "So basically, what I did here is I took a **[Data Structure / Approach]** to keep it simple and fast."
   - "First, I'm checking if the input is empty or null. Then I loop through it once, update the values, and return the result."

2. Complexity (1 short line):
   - "For performance, **Time Complexity is O(...)** because we only iterate once, and **Space Complexity is O(...)** to hold the data."

3. Theory/Concept Question (If asked in the prompt):
   - "And coming to your question about [concept]... so basically what happens is [explain in 2 simple sentences using plain words]."

STRICT RULES:
- Never use academic terms like "auxiliary space traversal", "linear scan", or "brute force comparisons".
- Keep every sentence under 12–14 words so the candidate never trips while speaking.

Start directly with the code block.
`.trim();
}