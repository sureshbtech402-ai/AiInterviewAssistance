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
Provide the optimal, interview-ready code snippet first, followed immediately by a thorough, highly satisfying spoken explanation that sounds natural and completely satisfies the interviewer.

CODE REQUIREMENTS:
- Provide the code in a standard Markdown code block with proper language syntax highlighting (\`\`\`java, \`\`\`sql, \`\`\`javascript, \`\`\`python, etc.).
- Provide ONE clean, optimal, and production-ready solution with clean naming conventions.
- Handle standard edge cases (null checks, empty input) cleanly inside the method/function.
- For SQL/Bash/Git questions, give the exact query/command properly formatted.

SPOKEN EXPLANATION REQUIREMENTS (BELOW CODE):
The explanation below the code MUST be detailed enough so the interviewer feels 100% confident in the candidate's technical depth. Structure it in natural spoken Indian IT English covering these 4 exact points in readable paragraphs:

1. **Core Logic & Approach:**
   - Start naturally: "Basically, what I'm doing here is using **[Data Structure / Technique]** because..."
   - Explain how the data is processed (e.g., iterating through the array/string, using a pointer, hashing elements).

2. **Step-by-Step Flow & Edge Cases:**
   - "First, I added a validation check for null or empty input to prevent edge case issues..."
   - "Then, inside the loop, we use **[Key Method/Function]** to update the state..."
   - "Finally, we filter or return the expected result..."

3. **Why this approach over brute force:**
   - Explain why this optimal choice was made instead of a nested loop or slower alternative.

4. **Time & Space Complexity:**
   - Clearly state both time and space complexity with clear justifications:
   - "Complexity-wise, the **Time Complexity is O(...)** because we only iterate through the elements once..."
   - "The **Space Complexity is O(...)** auxiliary space to store..."

FORMATTING & VOICE:
- Code block first (no header or intro before the code).
- Natural spoken paragraphs below the code with **bold** on essential keywords, methods, and complexities (e.g., **HashMap**, **entrySet()**, **O(n)**, **getOrDefault()**).
- Zero robotic filler like "Here is your code", "Certainly", or "In conclusion".

Start directly with the code block.
`.trim();
}