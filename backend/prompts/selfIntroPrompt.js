import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildSelfIntroductionPrompt({
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

The interviewer asked:

"${question}"

Give the candidate's self-introduction based ONLY on the Candidate Profile.

The introduction should sound like the candidate is naturally talking
about their career and current work, not reading their resume.

Use the resume as the source of facts, but convert those facts into
natural spoken English.

Cover the most relevant points naturally:

- Name
- Total experience
- Current role and company
- Main technical skills
- Current/recent project
- What the project does
- What the candidate actually works on
- Relevant responsibilities
- Previous experience only if useful

Do not mention every skill or every responsibility from the resume.

Select the strongest and most relevant information.

Instead of listing technologies:

"Java, Spring Boot, Microservices, Hibernate, REST, SQL, Docker,
Kubernetes..."

connect them naturally:

"My main experience is with Java and Spring Boot, mainly working on
REST APIs and microservices. I've also worked with databases and
containerized deployments."

Make the introduction feel personal and conversational.

Use natural phrases when they fit:

"Currently, I'm working..."
"My main experience is..."
"In my current project..."
"I mainly work on..."
"Apart from that..."
"Recently, I've been working on..."

Do not force these phrases into every introduction.

When explaining the project, briefly explain:
what the application does, why it is used, and what the candidate
actually contributes to it.

Do not explain the complete architecture unless the interviewer asks.

Use first person naturally.

Say:
"I worked on..."
"I implemented..."
"I was responsible for..."
"We used..."
"My role was..."

Never say:
"The candidate..."
"According to my resume..."
"Based on my profile..."
"My resume says..."

Never invent any information.

Do not invent:
- Experience
- Companies
- Projects
- Technologies
- Responsibilities
- Clients
- Achievements
- Numbers
- Domain experience

If something is not available in the Candidate Profile, simply skip it.

The introduction should sound like an experienced Indian software
professional speaking naturally to an interviewer.

Keep the English simple, professional and conversational.

Do not use overly formal phrases such as:

"I possess extensive knowledge..."
"I have profound expertise..."
"I am highly proficient in..."
"I would like to elaborate..."
"Furthermore..."
"Additionally..."
"Moreover..."
"In conclusion..."

Do not make it sound memorized.

Avoid this style:

"My name is X. I have X years of experience. My skills are A, B, C,
D, E. My project is X. My responsibilities are A, B, C..."

Instead, connect the information naturally into a conversation.

Target around 60-90 seconds when spoken.

Do not force the length.

If the profile has limited information, keep it shorter.

End naturally without a forced career-goal statement.

A simple closing is enough if it fits naturally.

Return ONLY the self-introduction.

No headings.
No bullets.
No markdown.
No emojis.
No explanations.
No notes to the candidate.

Start directly with the introduction.
`;
}