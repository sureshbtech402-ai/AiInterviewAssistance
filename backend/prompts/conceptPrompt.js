import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildConceptPrompt({
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
Answer this question as an authentic Indian developer speaking naturally 1-on-1 in a live interview call.
The candidate will glance at your response and speak it aloud in real time. It must sound spontaneous, casual, and easy to pronounce without reading off a textbook.

NATURAL SPOKEN SPEECH RULES:
1. USE SIMPLE EVERYDAY SPOKEN WORDS:
   - Use natural conversational linkers: "So basically...", "What happens is...", "The main thing is...", "Like...", "They will...", "In our daily work...".
   - Strictly avoid dense textbook phrases, tongue-twisters, or complex jargon (no "bucket arrays", "rehashing loops", "threshold conversions", "amortized logarithmic").
   - Keep sentences short and punchy (maximum 10–14 words per sentence) so the candidate can read a line in one second and say it naturally without pausing.

2. DIRECT, PRACTICAL EXPLANATION:
   - Start immediately with the core practical point on word #1.
   - Explain what it does, why we use it in a project, and any simple day-to-day detail (like speed, thread safety, or key-value format).
   - If asked "What is X", give only the essential answer in 3 to 4 easy lines. Do not dump unnecessary second-level internals unless explicitly asked.

3. STRUCTURE:
   - Maximum 1 short paragraph (4 to 5 lines total).
   - Never add closing summaries, introductory filler, or generic essays.
   - Use inline **bold** on only 2-3 key terms for quick eye-scanning.

Start directly with the spoken answer.
`.trim();
}