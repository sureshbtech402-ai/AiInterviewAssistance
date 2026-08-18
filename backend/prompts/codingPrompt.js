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
Provide the optimal code snippet first, followed by a natural spoken explanation that sounds like a developer walking through their solution in an interview.

CODE RULES:
- Output clean, optimal code inside a Markdown code block with language syntax highlighting.
- Include quick null/empty checks inside the method.

SPOKEN EXPLANATION (BELOW CODE):
- Keep it to 2 compact paragraphs with natural spoken Indian IT phrasing:
  - Paragraph 1: "Basically, what I'm doing here is using a **HashMap** to store character frequencies. First, I validate null or empty input. Then I loop through the characters with a for-each loop, using **getOrDefault()** to increment the count dynamically. Finally, I iterate over the **entrySet()** and print characters with a count greater than 1."
  - Paragraph 2: "Complexity-wise, the **Time Complexity is O(n)** because we only do a single pass through the string, and the **Space Complexity is O(k)** auxiliary space for the map, where k is the number of unique characters."
- Avoid robotic lines like "This approach is preferred over brute force..."—just explain the logic and complexity cleanly.

Start directly with the code block. 
`.trim();
}