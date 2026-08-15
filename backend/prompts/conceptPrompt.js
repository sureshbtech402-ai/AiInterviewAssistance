import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildConceptPrompt({
  question,
  interviewLevel,
  company,
  interviewType,
}) {
  return `
${buildCommonSystemPrompt({ interviewLevel, company, interviewType })}

Question: "${question}"

Respond like you are answering verbally in 2 to 3 spoken sentences:
1. Explain what it is practically (start with "Basically..." or "In Java/our stack...").
2. State why we use it or give a real project example.
3. Keep it under 45 words.
`.trim();
}