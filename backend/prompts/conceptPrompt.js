import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildConceptPrompt({
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
INTERVIEW QUESTION
=========================

${question}

=========================
INSTRUCTIONS
=========================

Answer exactly like a real software engineer speaking in a live interview.

The Candidate Profile below is already extracted by GPT-5.
Use it as the only source for the candidate's:

• Experience
• Company
• Projects
• Responsibilities
• Skills
• Achievements

Never invent anything outside the Candidate Profile.

If the profile contains relevant project experience,
naturally connect your answer to that project.

If the profile does NOT show direct experience,
say naturally:

"I haven't worked directly on this, but based on my experience, this is how it works."

Then explain the concept correctly.

Use simple natural Indian spoken English.

Keep the answer conversational.

Use practical examples whenever useful.

If asked a comparison question,
compare only the requested topics.

If asked about annotations,
explain:

• Purpose
• How it works
• Real-time usage
• Simple example

=========================
OUTPUT FORMAT
=========================

## 🎯 Interview Answer

Choose only relevant sections such as:

## 💼 Real-Time Usage

## ✅ Advantages

## ⚠️ Limitations

## 🔄 Comparison

## 📝 Example

## 🚀 Best Practice

Use Markdown.

Bold important keywords.

Use bullets wherever useful.

Avoid long paragraphs.

Do not create tables.
`;
}