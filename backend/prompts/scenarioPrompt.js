import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildScenarioPrompt({
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
Answer this scenario or debugging question naturally, just like an experienced Indian developer explaining how they solve issues in daily production work.
The candidate will look at this and speak it directly on the call. Keep it conversational, clear, and easy to pronounce.

SPOKEN FLOW (PRACTICAL & REALISTIC):
- Speak directly in the first person ("In our project...", "What I usually do first is...", "Then I check...").
- Keep sentences short (10–14 words max) so it sounds like real speech, not an essay.
- Use natural spoken words: "So basically...", "Like...", "They will...", "First thing is...", "What happens is...".

TYPICAL STEP-BY-STEP BREAKDOWN:
1. Daily Work / Jira:
   - "Day-to-day, after our morning standup, I pick up my assigned tasks or bug tickets in **Jira**."
2. Check Logs:
   - "Whenever a bug comes in, the first thing I do is check the **application logs** using the request ID to see the exact error and stack trace."
3. Reproduce & Fix:
   - "Then I try to reproduce the same issue in our local or QA environment with the same data."
   - "Once I find the issue, I fix the code, write unit tests to make sure nothing breaks, and create a **pull request** for team review."
4. If asked about a Critical Production Issue:
   - "If it's a critical production outage, the priority is to rollback or restart the service first so users aren't impacted, and then analyze the logs and take thread dumps to find the root cause."

STRICT RULES:
- Use only logging tools and frameworks mentioned in the Candidate Profile (e.g., Kibana, Splunk, JUnit).
- Do not use stiff academic phrases (no "isolate root cause", "prevent regressions", "structured paradigm").
- Maximum 4 to 5 short lines total.

Start directly with the spoken answer.
`.trim();
}