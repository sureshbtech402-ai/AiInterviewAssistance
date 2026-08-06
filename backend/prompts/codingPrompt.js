import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildCodingPrompt({
  question,
  resumeProfileContext,
  interviewLevel,
  company,
  interviewType,
}) {
  return `
${buildCommonSystemPrompt({
  resumeProfileContext,
  interviewLevel,
  company,
  interviewType,
})}

=========================
CODING INTERVIEW
=========================

Interview Question:

${question}

=========================
INSTRUCTIONS
=========================

Answer exactly like a software engineer solving the problem during a live interview.

The Candidate Profile below was already extracted by GPT-5.

Use it ONLY to identify the candidate's primary programming language.

If the interviewer does not specify a language,
use the candidate's primary language from the profile.

Write the cleanest and most commonly used solution.

Use meaningful variable names.

Avoid unnecessary complexity.

After the code, explain:

• How the solution works

• Time Complexity

• Space Complexity

Mention one or two interview follow-up questions if relevant.

Keep the explanation simple and interview-ready.

Do not invent project examples or resume experience.

=========================
OUTPUT FORMAT
=========================

## 💻 Solution

\`\`\`
[Code]
\`\`\`

## 📝 Explanation

...

## ⏱ Complexity

**Time:** ...

**Space:** ...
`;
}