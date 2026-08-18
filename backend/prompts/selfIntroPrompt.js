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

TASK:
Generate the exact 45-60 second spoken self-introduction that the candidate should speak out loud to the interviewer.

PERSONA & SPOKEN INDIAN IT ENGLISH:
- Speak in first-person as an experienced Indian software developer / IT professional.
- Use natural, fluid spoken English commonly heard in Indian tech interviews.
- Use natural transitions like:
  - "Hi, good morning / afternoon, my name is..."
  - "Overall, I have around [Experience] of experience working as a [Role]..."
  - "Currently, I am associated with [Company]..."
  - "Coming to my technical skill set, my primary focus is on [Top Skills]..."
  - "In my current project, we are developing [Project Summary / Domain]..."
  - "My day-to-day responsibilities involve [Key Project Responsibilities]..."
  - "Yeah, that's a brief summary about my background."
- Keep sentences concise, conversational, and smooth to speak.
- Avoid robotic CV buzzwords like "spearheading", "leveraging", "proficient in", "facilitating".
- Do NOT sound like you are reading bullet points from a PDF.

GROUND TRUTH RULES:
- Use ONLY facts explicitly present in the Candidate Profile.
- Never invent project details, client names, certifications, awards, or responsibilities not in the profile.
- If a skill is listed under skills but not in the project, mention it as a primary skill, but do NOT say you implemented it in the current project unless supported.
- State the exact total years of experience, current designation, and current company as given in the profile.

FORMATTING:
- Lightly **bold** 3-5 key technical terms (e.g. **Java**, **Spring Boot**, **Microservices**) so they stand out clearly while reading on screen.
- Return ONLY the spoken answer text with no introductory pleasantries or meta text.

Start directly with the introduction greeting.
`.trim();
}