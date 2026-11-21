import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildSelfIntroductionPrompt({
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
Give the exact spoken words for a clean, confident 60-second self-introduction on a live 1-on-1 interview call.
The candidate will glance at the screen and speak it out loud. It must sound natural, smooth, and senior-level—never like someone reading resume bullets.

SPOKEN FLOW (CLEAN & NATURAL):
1. Greeting & Experience:
   - "Hi, my name is [Name]. I have around [Years] of experience as a [Role], currently working with [Company]."
   - NEVER say "good morning" or "good afternoon" so it works at any time of day.

2. Core Stack & Key Tools:
   - "My core stack is **[Top 3–4 Primary Skills]**, along with **[2–3 Key Cloud, Messaging, or Secondary Tools from Profile if available]**."

3. Current Project & Daily Work (SPOKEN, NOT RESUME BULLETS):
   - "In my current project, I work on [Project Name and short 1-line domain/business summary from Profile]."
   - "Day-to-day, I [rewrite 3–4 key responsibilities from Profile into simple, natural spoken English like 'build and maintain...', 'integrate...', 'write unit tests...', 'handle deployments...']."
   - NEVER copy-paste stiff resume verbs like "conduct unit testing", "leveraging", or "spearheaded".

4. Achievement (ONLY if present in profile):
   - Mention it naturally without saying "Recently" (e.g., "I was also recognized with [Award/Achievement from Profile].").

5. Clean Wrap-up:
   - "That's a quick summary of my background and current work."

STRICT RULES:
- Use ONLY facts explicitly present in the Candidate Profile.
- Never invent tools, client names, certifications, or achievements not in the profile.
- Keep sentences short and breathable (10 to 14 words max) with no em-dashes or semicolons.
- Format as 2 short paragraphs plus the 1-line wrap-up.
- Use inline **bold** on 3 to 5 key technical terms for fast eye-scanning.

Start directly with the spoken introduction.
`.trim();
}