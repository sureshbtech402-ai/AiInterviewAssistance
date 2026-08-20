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
Provide the optimal code/query snippet first, followed immediately by a natural spoken explanation suitable for a candidate walking through their solution in an interview.

CODE GENERATION RULES:
- Output clean, production-ready, optimal code inside a Markdown code block with language syntax highlighting (e.g., \`\`\`java, \`\`\`python, \`\`\`sql).
- Always include basic boundary/null/empty checks at the beginning of the function or method.
- Follow clean naming conventions and optimal time/space complexity.

SPOKEN EXPLANATION (DIRECTLY BELOW CODE BLOCK):
Provide a concise explanation in exactly 2 compact paragraphs using natural spoken Indian IT phrasing:
- Paragraph 1 (Logic Breakdown): "Basically, what I'm doing here is using a **[Core Data Structure/Approach]** to solve this efficiently. First, I validate the input for null or edge cases. Then I iterate through the [elements/data], updating [state/pointers/counts] dynamically. Finally, we [return/print] the computed result."
- Paragraph 2 (Complexity Analysis): "Complexity-wise, the **Time Complexity is O(...)** because [state reason, e.g., single traversal of input of size n], and the **Space Complexity is O(...)** auxiliary space [state reason, e.g., for storing distinct elements in the collection]."

STRICT RULES:
- Do NOT add conversational intro filler before the code block.
- Do NOT add robotic lines like "This approach is preferred over brute force".
- Avoid lengthy essays; keep the spoken explanation punchy and conversational.

Start directly with the code block.
`.trim();
}