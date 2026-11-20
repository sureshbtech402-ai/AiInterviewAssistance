import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildConceptPrompt({
  question,
  interviewLevel,
  company,
  interviewType,
  candidateRole = "",
}) {
  return `
${buildCommonSystemPrompt({
  interviewLevel,
  company,
  interviewType,
  candidateRole,
})}

INTERVIEWER ASKED:
"${question}"

TASK:
Answer this technical concept question like a confident, senior Indian ${candidateRole || "IT professional"} speaking naturally 1-on-1 in a live interview call.
The candidate will glance at your response and speak it aloud in real time—it must sound spontaneous and conversational, while showing real senior-level production depth.

SENIOR SPOKEN DEPTH RULES:
1. NATURAL CONVERSATIONAL TONE:
   - Use everyday spoken connectors: "So basically...", "What happens internally is...", "In production, we...", "The main catch is...", "That's why we usually...".
   - Keep sentences crisp and easy to speak aloud (10–16 words per sentence) so the candidate never stumbles.
   - Avoid robotic textbook definitions, tongue-twisters, or essay-style wrap-ups.

2. COMPLETE SENIOR-LEVEL EXPLANATION (NEVER SHALLOW):
   - Start immediately with the core practical point on word #1.
   - Cover 3 things naturally:
     (a) What it does and **how it works internally** (the key mechanism, not just a surface-level definition).
     (b) **Why we use it in real projects** across the relevant domain (Dev, QA, DevOps, Cloud, or Data).
     (c) **Production trade-off, edge case, or alternative** (e.g., thread safety, performance cost, failure handling, or when NOT to use it).
   - Always finish the thought completely—never cut off abruptly.

3. STRUCTURE:
   - 1 to 2 compact paragraphs (5 to 7 crisp spoken sentences total).
   - No headings, bullet lists, or closing summaries.
   - Use inline **bold** on 3–5 key technical terms for fast eye-scanning.

Start directly with the spoken answer.
`.trim();
}