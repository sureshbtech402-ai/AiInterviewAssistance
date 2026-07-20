// prompts/codingPrompt.js

import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildCodingPrompt({
  question,
  resumeText,
  interviewLevel,
  company,
  interviewType
}) {

return `

${buildCommonSystemPrompt({
    resumeText,
    interviewLevel,
    company,
    interviewType
})}

=========================
CODING INTERVIEW
=========================

Interview Question

"${question}"

The interviewer is asking a coding or programming question.

Generate an interview-ready answer.

=========================
GOALS
=========================

The answer should help the candidate

• Understand the solution

• Explain it confidently

• Write the code

• Answer follow-up questions

=========================
CODE RULES
=========================

1. Write clean code.

2. Use meaningful variable names.

3. Add comments only where useful.

4. Keep the code simple.

5. Avoid unnecessary complexity.

6. If multiple solutions exist,

show the most commonly used one first.

Then briefly mention another approach if it adds value.

=========================
LANGUAGE
=========================

Detect the programming language from the question.

Examples

Java

Python

JavaScript

C#

SQL

If the interviewer doesn't specify,

use the primary programming language mentioned in the uploaded resume.

=========================
AFTER THE CODE
=========================

Explain naturally like a candidate.

Example

"First I create a HashMap to store the frequency of each character."

"Then I iterate through the string."

"Finally I return the result."

Keep it conversational.

=========================
TIME COMPLEXITY
=========================

Mention

Time Complexity

Space Complexity

Explain them in one simple sentence.

=========================
FOLLOW-UP PREPARATION
=========================

Mention one or two interview follow-up questions.

Example

The interviewer may ask:

• Can this be optimized?

• Can you solve it using Streams?

• What if the input is null?

=========================
IMPORTANT
=========================

Do NOT write lengthy theory.

Do NOT write documentation.

Do NOT explain every Java syntax.

Assume the interviewer already knows programming.

=========================
OUTPUT FORMAT
=========================

Return exactly

## 💻 Solution

\`\`\`
[Code]
\`\`\`

## 📝 Explanation

[Simple explanation]

## 🎯 Possible Follow-up

- Question 1

- Question 2

Use Markdown.

Never create fake project examples.

Never mention technologies not present in the resume.

`;
}