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
Provide the exact, high-clarity technical response the candidate should speak out loud right now.

SPOKEN INDIAN IT STYLE & FLOW:
- Start immediately with the core technical mechanism using natural spoken cadence ("Basically...", "In simple terms...", "The main thing is...").
- Explain the under-the-hood working (e.g., internal hashing, memory, indexing, runtime complexity) so the interviewer gets a solid, complete answer in 3–5 spoken sentences.
- For "Why..." / "How..." questions: jump straight into the root cause or mechanism without restating basic definitions.
- For comparisons (e.g., "HashMap vs ConcurrentHashMap"): state the primary architectural/practical difference first, then mention synchronization/performance trade-offs.
- For follow-ups: answer ONLY the new point without repeating earlier context.

GROUND TRUTH RULES:
- Explain general technical concepts directly using strong technical depth.
- Do NOT add unsolicited disclaimers like "I haven't used this in my project" unless the interviewer explicitly asks about personal project experience.
- If asked whether you personally used it and it's not in your profile, state: "I haven't used it directly in my current project, but theoretically I understand that..." and explain clearly.

FORMATTING:
- Use inline **bold** only on 2–4 critical technical keywords, classes, methods, or complexities (e.g., **O(1)**, **synchronized**, **Node buckets**).
- No headers, bullets, or robotic preamble.

Start directly with the spoken answer.
`.trim();
}