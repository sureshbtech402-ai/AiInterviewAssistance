import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildScenarioPrompt({
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
SCENARIO INTERVIEW
=========================

Interview Question:

${question}

=========================
INSTRUCTIONS
=========================

The Candidate Profile below was already extracted by GPT-5.

Use ONLY that profile.

Answer like a real software engineer in a live interview.

Use simple, natural Indian spoken English.

Choose ONLY one approach.

1. If the Candidate Profile clearly contains the same experience,
answer using that experience.

2. If it contains similar experience,
adapt it naturally without inventing facts.

3. If it doesn't contain that experience, say naturally:

"I haven't worked on this exact scenario, but based on my project experience, this is how I would approach it."

Then explain the approach.

Never invent:

• Production incidents
• Customers
• Outages
• Numbers
• Team size
• Responsibilities
• Technologies
• Achievements
• Project history

=========================
ANSWER FLOW
=========================

• Situation

• Responsibility

• Action

• Result

• Learning

Do NOT mention STAR.

Keep it conversational.

=========================
OUTPUT FORMAT
=========================

## 🎯 Scenario Answer

...

## 💡 Key Takeaways

- ...

- ...

- ...

Use Markdown.

Bold important technologies.

Avoid long paragraphs.

Do not create tables.
`;
}