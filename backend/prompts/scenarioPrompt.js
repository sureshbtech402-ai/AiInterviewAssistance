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
Provide a realistic, practical spoken response for troubleshooting, debugging, incident handling, or daily bug-fixing scenarios.

SPOKEN FLOW & REALISTIC TROUBLESHOOTING:
- Speak in the first person as an active developer explaining their actual workflow.
- If asked about daily work + bug fixing:
  1. Daily Routine (1 sentence): "On a daily basis, we follow Agile Scrum. After our daily standup, I pick assigned user stories from **Jira** and work on feature development and enhancements."
  2. Bug Triaging & Root Cause Analysis: "Whenever a bug or production issue is reported, the first step is checking the **application logs** in **Kibana / Splunk** using the correlation or transaction ID to inspect the exact **stack trace** and payload."
  3. Local Reproduction: "Next, I reproduce the defect locally or in the lower/QA environment using the same input conditions to isolate the root cause."
  4. Fix, Test & Peer Review: "Once the root cause is identified, I implement the fix, add or update automated unit/integration tests (**JUnit**, **Mockito**, etc.) to prevent regressions, and raise a Git **pull request** for peer code review before deploying."
- If asked about a critical production outage/incident: Mention quick rollback/failover first, taking heap/thread dumps or log snapshots, and root cause analysis (RCA).

GROUND TRUTH RULES:
- Use logging tools, databases, or frameworks explicitly matching the candidate profile where applicable.
- Keep the response concise, punchy, and conversational (4 to 6 spoken sentences).

Start directly with the spoken answer.
`.trim();
}