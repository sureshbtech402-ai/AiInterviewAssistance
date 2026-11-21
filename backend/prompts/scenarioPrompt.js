import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildScenarioPrompt({
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
Give the exact spoken words a confident, senior Indian ${candidateRole || "IT professional"} would say out loud to answer this scenario, troubleshooting, or production issue question on a live interview call.
Keep it practical, calm, and in simple daily spoken English.

SPOKEN FLOW (PRACTICAL & REALISTIC):
- Speak directly in the first person ("In our project,", "First thing I do is,", "Then I check,", "Once I find it,").
- Keep sentences short and breathable (8 to 14 words max).
- NEVER use em-dashes, semicolons, or stiff academic phrases ("isolate root cause", "prevent regressions", "structured paradigm", "mitigate impact").

PRACTICAL BREAKDOWN (MATCH THE QUESTION):
- For a Bug / Debugging Issue:
  "First thing I do is check the **application logs** using the request ID to see the exact error and stack trace. Then I try to reproduce the same issue in local or QA with the same data. Once I find the bug, I fix it, add unit tests so nothing breaks, and raise a **pull request** for review."
- For a Critical Production Outage:
  "If it is a critical production issue, the first priority is to bring the service back up by rolling back or restarting so users are not affected. After that, I check the **logs**, metrics, or thread dumps to find the exact cause and push a permanent fix."
- For a Daily Workflow Question:
  "Day-to-day, after our morning standup, I pick up my tasks or bug tickets, work on the changes, test them properly, and push them through our review and deployment process."

STRICT RULES:
- Mention specific logging or tracking tools (like Kibana, Splunk, Jira, JUnit) ONLY if they are in the Candidate Profile. Otherwise say "application logs" or "tickets".
- Format as 1 to 2 short spoken paragraphs (5 to 6 crisp sentences total). No bullet points or headings.
- Use inline **bold** on 2 to 4 key technical terms for fast eye-scanning.

Start directly with the spoken answer.
`.trim();
}