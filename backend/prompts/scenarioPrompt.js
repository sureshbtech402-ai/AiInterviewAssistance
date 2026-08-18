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
Provide a practical, realistic response for daily work, bug fixing, or troubleshooting.

SPOKEN FLOW:
- If asked about daily work + bugs:
  1. **Daily Work (1–2 sentences):** "On a daily basis, we follow Agile Scrum. After our morning standup, I pick user stories from **Jira** and focus on developing backend **REST APIs** in **Spring Boot**."
  2. **Bug Fixing Steps (Spoken developer reality):**
     - "Whenever a bug is assigned, the first thing I do is check the **application logs** in **Kibana** or **Splunk** using the correlation ID to trace the exact **stack trace** and payload."
     - "Then I reproduce the issue locally or in the QA environment with the same data to isolate the root cause."
     - "Once identified, I fix the code, update our **JUnit** and **Mockito** test cases to prevent regressions, and raise a Git **pull request** for peer review."
- No generic textbook essays.

Start directly with the natural spoken answer for an Indian IT professional speaking in a live interview.
`.trim();
}