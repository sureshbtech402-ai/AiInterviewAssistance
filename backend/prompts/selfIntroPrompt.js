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

INTERVIEWER ASKED:
"${question}"

SELF-INTRODUCTION TASK:

Give the exact self-introduction the candidate should speak to the interviewer.

The introduction should normally take around 45-60 seconds when spoken.
Do not target an exact word count. Prioritize natural speech and relevant information.

CONTENT PRIORITY:

Include the most important information in this order when supported by the Candidate Profile:

1. Candidate name and total experience.
2. Current role and company.
3. Main technical skills relevant to the candidate's role.
4. Current project and what the project does.
5. What the candidate personally works on.
6. One or two important responsibilities or relevant experience.
7. A short natural closing.

Do not mention every skill, technology, tool, responsibility, achievement, or project detail from the profile.

The introduction should sound like the candidate is naturally introducing himself, not reading his resume.

NATURAL LIVE-INTERVIEW SPEECH:

- Speak like a real Indian IT professional in a live interview.
- Use simple Indian spoken English.
- Keep sentences short, natural, and easy to speak aloud.
- Use normal conversational English used by Indian software professionals.
- Natural phrases such as "Currently I'm working on...", "My main work is...", "Basically...", "I mainly handle...", and "In my project..." can be used when they fit naturally.
- Do not force these phrases.
- Do not intentionally use incorrect grammar.
- Do not use overly polished native-English expressions.
- Avoid resume language such as "proficient", "extensive expertise", "leveraging", "facilitating", "spearheading", "robust", "demonstrated expertise", or similar phrases.
- Avoid long corporate sentences.
- Do not make the introduction sound scripted or memorized.
- Do not repeat the same information in different words.
- Do not explain individual technologies unless they are important to understanding the candidate's work.

FACTUAL ACCURACY:

The Candidate Profile is the only source of truth for the candidate's actual experience.

Use only facts explicitly supported by the Candidate Profile.

Never invent:
- technologies
- tools
- projects
- clients
- responsibilities
- architecture
- migrations
- cloud platforms
- databases
- integrations
- achievements
- metrics
- experience

A skill listed in the profile does NOT automatically mean:
- it was used in the current project
- the candidate implemented it
- the candidate deployed it
- the candidate integrated it
- the candidate has production experience with it

Only say:
"I worked on..."
"I implemented..."
"I used..."
"We use..."
"My responsibility is..."

when the Candidate Profile supports that statement.

If a project detail is missing from the profile, skip it instead of guessing.

PROJECT DESCRIPTION:

When describing the current project:
- Briefly explain what the project is for.
- Mention the domain only if supported by the profile.
- Mention the candidate's actual responsibilities.
- Do not turn the complete project architecture into the self-introduction.
- Do not list every project technology.
- Keep the project explanation easy for the interviewer to follow.

EXPERIENCE CONSISTENCY:

Use the experience exactly as provided in the Candidate Profile.

Do not calculate, round, increase, or change the candidate's years of experience.

Do not introduce a different designation or company name.

ENDING:

Finish naturally after covering the important background.

A simple ending such as:
"That's a brief overview of my experience."

is enough.

Do not use:
"Yeah, that's all about my self."
"Thank you for giving me this opportunity."
"I am very passionate about..."
"I am a highly motivated professional..."

unless the interviewer specifically asks for such information.

OUTPUT:

Return only the exact spoken self-introduction.

No headings.
No bullets.
No markdown.
No quotation marks.
No filler before the introduction.

Start directly with:
"Hi, I'm..."
`.trim();
}