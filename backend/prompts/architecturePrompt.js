import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildArchitecturePrompt({
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
Answer this architecture, framework, or project flow question in 6 to 8 natural spoken sentences as the candidate in an Indian corporate interview.

SPEECH STRUCTURE:
- Direct Flow / Framework Summary: State the high-level architecture/framework stack directly in the first sentence ("In our project, we follow a BDD Cucumber framework built on top of Selenium and Java...", "The request flow basically starts from...").
- Layer / Component Interaction: In 6-8 sentences, briefly connect only the relevant layers (e.g., Feature files -> Step definitions -> Page Objects -> Utilities/Reports -> Jenkins CI/CD).
- Candidate Role: 1 sentence on what you specifically handle or maintain.
- If it is a generic system design question, answer the design flow practically without falsely claiming personal production implementation.

STRICT RULES:
- First-person spoken phrasing only ("In our project...", "Basically, the flow is...", "We maintain...").
- Stick strictly to the Candidate Profile; never invent unlisted databases, microservices, or tools.
- Keep it concise so it can be spoken.
- NO headings, NO bullet points, NO markdown diagrams, NO textbook theory.
- Return ONLY the exact spoken words. Start speaking immediately.
`.trim();
}