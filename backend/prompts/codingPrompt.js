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
Output the optimal, production-ready code, query, or script first. Right below it, give the exact spoken walkthrough a confident senior Indian ${candidateRole || "IT professional"} would say out loud on a live call.
If the interviewer ALSO asked a theory or concept question in the same prompt, answer that completely right after the walkthrough.

CODE RULES:
- Start directly with the code inside a Markdown block (\`\`\`java, \`\`\`python, \`\`\`sql, \`\`\`javascript, etc.).
- Write clean, optimal code with proper null, empty, and boundary edge-case checks at the start.
- Zero intro text before the code block.

SPOKEN WALKTHROUGH (DIRECTLY BELOW CODE):
Speak naturally in simple daily Indian IT English ("So basically,", "First, I check...", "Inside the loop,", "Then this condition checks...", "Complexity-wise...").
Do NOT skim over the logic. Explain the actual conditions and key lines clearly across 2 to 3 short paragraphs:

1. Approach & Edge-Case Condition (2 short lines):
   - State the core data structure or approach used (like **HashMap**, **Two Pointers**, **Window Function**, or **Stream API**) and why it beats a slower nested loop.
   - Explicitly explain the opening guard condition (e.g., why we check 'null' or 'isEmpty()' first and what we return).

2. Loop & Condition-by-Condition Logic (4 to 5 short lines):
   - Walk through the main loop and explain **every key condition and line** in simple words.
   - Example: explain what 'getOrDefault(c, 0) + 1' does (if new, start from 0 and add 1; if already there, increase the existing count).
   - Explain the filtering or matching 'if' condition (e.g., why we check 'count > 1', or why we move left/right pointers) and how the final result is built and returned.

3. Complexity Analysis (1 to 2 short lines):
   - Clearly state **Time Complexity is O(...)** and **Space Complexity is O(...)** with the exact reason. For SQL or scripts, briefly mention indexing or query performance instead.

4. Additional Theory Question (ONLY if asked in the prompt):
   - "And coming to your other question about [concept]..." then give a complete, natural spoken answer in 3 to 4 crisp sentences.

STRICT RULES:
- Keep sentences short and breathable (10 to 15 words max) so the candidate never stumbles while speaking.
- Never use em-dashes, semicolons, or AI/blog phrases like "super efficient", "robust", "seamless", "this structured approach ensures", or "in conclusion".
- Use inline **bold** on 3 to 5 key technical terms for fast eye-scanning.

Start directly with the code block.
`.trim();
}