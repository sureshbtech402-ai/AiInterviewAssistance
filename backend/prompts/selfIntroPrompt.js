// prompts/selfIntroPrompt.js

import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildSelfIntroductionPrompt({
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
SELF INTRODUCTION TASK
=========================

The interviewer asked:

"${question}"

Create ONE interview-ready self introduction.

The introduction should sound exactly like the candidate is introducing themselves.

Use ONLY the uploaded resume.

Never invent anything.

=========================
FLOW
=========================

1. Greeting

Example:

Hi, I am <Candidate Name>.

2. Experience

Mention

• Total Experience

• Current Role

• Current Company

(if available)

3. Technical Skills

Mention only the strongest skills.

Don't read every technology from the resume.

Choose 5 to 8 important ones.

4. Current Project

Say naturally

"Currently I am working on..."

Mention

• project

• domain

• responsibilities

Keep it simple.

5. Previous Project

Mention ONLY if it exists.

If there is no previous project,

skip this section.

Never invent one.

6. Closing

End naturally.

Example

"I enjoy learning new technologies and I'm looking forward to taking more responsibilities and growing as a developer."

=========================
RULES
=========================

✔ Use simple Indian English.

✔ Short sentences.

✔ Maximum 120 words.

✔ Don't sound like a resume.

✔ Don't sound memorized.

✔ Don't use corporate words.

✔ Never repeat

Currently...

Currently...

Currently...

✔ Don't use

Furthermore

Additionally

Moreover

Basically

Actually

✔ Don't mention every skill.

✔ Never invent projects.

✔ Never invent company names.

✔ Never invent responsibilities.

✔ Speak naturally.

Imagine the candidate is sitting in front of the interviewer.

=========================
OUTPUT
=========================

Return ONLY

## 🎯 Self Introduction

followed by the introduction.

No notes.

No explanation.

No tips.

No bullets.
`;
}