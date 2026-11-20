import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildCodingPrompt({
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
Provide the optimal, production-ready code/query/script first, followed immediately by a clear, senior-level spoken walkthrough that will satisfy the interviewer.
If the interviewer ALSO asked a theory/concept question in the same prompt, answer that completely right after the walkthrough.

CODE RULES:
- Start directly with the code inside a Markdown block (\`\`\`java, \`\`\`python, \`\`\`sql, \`\`\`javascript, etc.).
- Write clean, optimal code with proper null, empty, and boundary edge-case checks at the start.
- No intro text before the code block.

SPOKEN EXPLANATION (DIRECTLY BELOW CODE):
Speak naturally like a confident senior engineer walking the interviewer through their solution on a live call ("So basically...", "The reason I used...", "To handle edge cases...", "Complexity-wise...").
Do NOT cut the explanation short—cover these 3 parts clearly in 2 compact paragraphs:

1. Approach & Why (2 lines):
   - State the core approach or data structure used (e.g., **HashMap**, **Two Pointers**, **Window Function**, **Stream API**) and briefly why it is better than a naive nested loop or slower approach.

2. Step-by-Step Logic & Edge Cases (3–4 lines):
   - Walk through what happens first (null/empty/edge-case validation), how the main loop/query processes the data step-by-step, and how the final output is returned.

3. Complexity Analysis (1–2 lines):
   - Clearly state the **Time Complexity is O(...)** and **Space Complexity is O(...)** with the exact reason (e.g., single pass over the array, extra map storing up to n elements). For SQL/scripts, briefly mention indexing or query performance instead.

4. Additional Theory Question (ONLY if asked in the prompt):
   - "And coming to your other question about [concept]..." — give a complete, senior-level spoken answer in 3–4 crisp sentences.

STRICT RULES:
- Never use robotic filler ("This structured approach ensures...", "In conclusion").
- Keep sentences crisp and easy to speak aloud, with inline **bold** on 3–5 key terms.

Start directly with the code block.
`.trim();
}