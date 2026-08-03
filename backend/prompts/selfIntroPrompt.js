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
SELF INTRODUCTION
=========================

The interviewer asked:

"${question}"

Generate ONE natural interview-ready self introduction.

Use ONLY the uploaded resume.

Never invent anything.

=========================
UNDERSTAND THE RESUME FIRST
=========================

Before generating the introduction, carefully understand the entire resume.

Do NOT simply copy the company designation.

Instead, identify the candidate's actual professional profile based on:

• Skills
• Technologies
• Current Project
• Responsibilities
• Overall Experience

Examples

If the resume mainly contains

• Java
• Spring Boot
• Hibernate
• REST APIs
• Microservices

Introduce naturally as

"Java Backend Developer"

If it mainly contains

• Selenium
• TestNG
• Automation

Introduce naturally as

"Automation Test Engineer"

If it mainly contains

• React
• Angular

Introduce naturally as

"Frontend Developer"

If it contains both frontend and backend technologies

Introduce naturally as

"Full Stack Developer"

If it mainly contains

• AWS
• Docker
• Kubernetes
• CI/CD

Introduce naturally as

"DevOps Engineer"

If the candidate is a fresher,

introduce naturally as an Entry Level Software Developer or Recent Graduate.

Do NOT blindly use HR titles like

• Associate System Engineer
• Programmer Analyst
• Software Engineer Trainee
• Graduate Engineer Trainee

unless there is no better technical profile available.

Choose the role that best represents the candidate's real work.

=========================
FLOW
=========================

Generate the introduction naturally in this order.

1. Greeting

Example

Hi, I am <Candidate Name>.

2. Professional Introduction

Mention naturally

• Technical Profile
• Current Company
• Total Experience

Example

"I'm currently working as a Java Backend Developer at TCS and I have around 4 years of experience."

3. Core Technical Skills

Mention only the strongest 6 to 10 skills.

Do NOT list every technology.

Speak naturally.

4. Current Project

Start naturally with

"Currently, I'm working on..."

Mention

• Project Name

• Client or Domain

• What the application does

• Main responsibilities

Explain naturally.

5. Previous Company / Previous Project

Mention ONLY if explicitly available in the resume.

If not available,

skip completely.

Never invent.

6. Additional Responsibilities

If present in the resume,

mention naturally

• Production Support

• Bug Fixing

• Security Fixes

• REST API Development

• Docker

• Kubernetes

• Agile

• JIRA

• Unit Testing

Only include responsibilities that actually exist in the resume.

7. Career Goal

End naturally.

Example

"Now I'm looking for an opportunity where I can work on more challenging projects, improve my technical skills, and contribute effectively to the organization."

Finish with

"That's all about me.

Thank you."

=========================
RULES
=========================

✔ Use ONLY the uploaded resume.

✔ Never invent companies.

✔ Never invent projects.

✔ Never invent responsibilities.

✔ Never invent technologies.

✔ Never invent achievements.

✔ Mention previous company or previous project ONLY if available.

✔ Mention only resume-supported responsibilities.

✔ Speak naturally like a real software engineer.

✔ Use simple Indian spoken English.

✔ Don't sound like ChatGPT.

✔ Don't sound like documentation.

✔ Don't sound like reading the resume.

✔ Keep the flow conversational.

✔ Avoid repeating words like

Currently

Basically

Actually

Furthermore

Additionally

Moreover

✔ Use short sentences.

✔ Keep the introduction between 120 and 170 words.

=========================
OUTPUT
=========================

Return ONLY

## 🎯 Self Introduction

followed by the complete introduction.

No bullets.

No notes.

No explanation.

No tips.

The introduction should be ready to speak directly in a real interview.

`;
}