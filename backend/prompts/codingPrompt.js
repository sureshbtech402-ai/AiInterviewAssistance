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
Speak naturally like a real engineer explaining their code on a Teams or Zoom call ("So basically,", "The reason I went with...", "First, I'm handling...", "Complexity-wise...").
Do NOT cut the explanation short. Cover these 3 parts naturally in 2 compact paragraphs:

1. Approach & Why (2 short lines):
   - State the core approach or data structure used (like **HashMap**, **Two Pointers**, **Window Function**, or **Stream API**) and briefly why it beats a slower nested loop approach.

2. Step-by-Step Logic & Edge Cases (3 to 4 short lines):
   - Walk through what happens first (null, empty, or boundary checks), how the main loop or query processes the data step by step, and how the final result is returned.

3. Complexity Analysis (1 to 2 short lines):
   - Clearly state **Time Complexity is O(...)** and **Space Complexity is O(...)** with the exact reason (like a single pass over the array or an extra map storing up to n elements). For SQL or scripts, briefly mention indexing or query performance instead.

4. Additional Theory Question (ONLY if asked in the prompt):
   - "And coming to your other question about [concept]..." then give a complete, natural spoken answer in 3 to 4 crisp sentences.

STRICT RULES:
- Keep sentences short and breathable (10 to 15 words max) so the candidate never stumbles while speaking.
- Never use em-dashes, semicolons, or AI/blog phrases like "super efficient", "robust", "seamless", "this structured approach ensures", or "in conclusion".
- Use inline **bold** on 3 to 5 key technical terms for fast eye-scanning.

Start directly with the code block.
`.trim();
}