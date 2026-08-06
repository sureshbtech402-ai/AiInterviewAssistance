import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildSelfIntroductionPrompt({
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
SELF INTRODUCTION
=========================

Interview Question:

${question}

=========================
INSTRUCTIONS
=========================

Generate ONE interview-ready self introduction using ONLY the Candidate Profile.

The Candidate Profile was already extracted and structured by GPT-5.

Do NOT invent anything.

Identify the candidate's technical role from the profile.

Mention:

• Name

• Experience

• Current Company

• Technical Role

• Strong skills

• Current Project

• Responsibilities

• Previous Project (only if available)

• Career goal

End with:

"That's all about me. Thank you."

=========================
STYLE
=========================

• Natural Indian spoken English.

• Sound like a real interview candidate.

• Do not sound like ChatGPT.

• Do not read the profile.

• Speak naturally.

• Around 150-200 words.

=========================
OUTPUT
=========================

Return ONLY

## 🎯 Self Introduction

followed by the introduction.

`;
}