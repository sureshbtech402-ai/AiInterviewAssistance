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
Provide the practical, spoken response for this daily work / bug-fixing / troubleshooting question.

SPOKEN INDIAN IT STYLE & FLOW:
- Speak directly in first person as a hands-on developer.
- Keep the language natural, practical, and conversational.
- Avoid robotic corporate endings like "This collaborative approach helps maintain code quality..." or "When it comes to...".
- Structure the response naturally:
  1. **Daily Work (1–2 punchy sentences):** "On a daily basis, we follow Agile Scrum. After our morning standup, I pick user stories from **Jira** and focus on developing backend **REST APIs** in **Spring Boot**."
  2. **Bug Fixing Flow (Step-by-step developer reality):**
     - "Whenever a bug or defect is assigned, the first thing I do is check the **application logs** in **Kibana** or **Splunk** using the correlation/transaction ID to trace the exact **stack trace** and payload."
     - "Then, I reproduce the issue locally or in the QA environment and place debug points to isolate the root cause."
     - "Once identified, I fix the code, write or update **JUnit** and **Mockito** test cases to ensure there's no regression, and raise a Git **pull request** for peer review before deploying."

FORMATTING:
- Use inline **bold** on key developer tools and terms (e.g., **Jira**, **REST APIs**, **application logs**, **Kibana**, **stack trace**, **JUnit**).
- No unnecessary headers or formal closing summaries.

Start directly with the spoken answer.
`.trim();
}