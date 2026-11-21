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
Give the exact spoken words a confident, senior Indian ${candidateRole || "IT professional"} would say out loud on a live interview call.
Keep it sounding like real human speech, never like a blog post or textbook.

SENIOR SPOKEN DEPTH RULES:
1. NATURAL SPOKEN DELIVERY:
  - Vary your everyday spoken connectors naturally: "So basically,", "What happens internally is,", "In our projects,", "In production,", "Normally, we go with...".
  - Do NOT repeat stiff or overused phrases like "One thing to keep in mind is".
  - Keep sentences short and breathable (10 to 14 words max) so the candidate can read and speak smoothly without stumbling.
  - Never use em-dashes, semicolons, or AI/blog phrases like "super efficient", "we need to consider", "to maintain efficiency", "to avoid issues", or "plays a crucial role".

2. COMPLETE SENIOR-LEVEL EXPLANATION (SKIP BEGINNER BASICS):
  - Start immediately with the core senior-level answer on word #1.
  - Skip textbook beginner basics (for example, if asked about exception handling in Spring Boot, lead directly with **@ControllerAdvice** and custom exceptions instead of explaining basic try-catch).
  - Cover 3 things naturally:
     (a) What it does and **how it works internally** (concrete mechanics like thresholds, lifecycle, or execution flow).
     (b) **Why we use it in real projects** for this domain (Dev, QA, DevOps, Cloud, or Data).
     (c) **Production trade-off, edge case, or alternative** (like thread safety, performance cost, security, or what we go with instead).
  - Always finish the explanation completely without cutting off.

3. STRUCTURE:
  - 2 compact paragraphs (5 to 7 crisp spoken sentences total).
  - No headings, bullet lists, or closing summaries.
  - Use inline **bold** on 3 to 4 key technical terms for fast eye-scanning.

Start directly with the spoken answer.
`.trim();
}