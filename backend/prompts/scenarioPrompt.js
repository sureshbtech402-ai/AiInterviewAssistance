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
Provide the practical, step-by-step spoken response the candidate should speak out loud right now for this scenario, bug-fixing, or troubleshooting question.

SPOKEN INDIAN IT DEVELOPER STYLE & STEPS:
- Speak in first-person as a hands-on developer ("First thing I do is...", "Then I check...", "What we usually do is...").
- Follow the realistic 4-step troubleshooting flow used in IT projects:
  1. **Identify & Trace Logs:** Check application logs (via tools like **Kibana**, **Splunk**, or **CloudWatch**) using the correlation ID or timestamp to pinpoint the exact stack trace and error payload.
  2. **Replicate & Isolate:** Reproduce the bug in the local/QA environment with the same request data, isolating whether it's a null pointer, validation issue, database timeout, or downstream API failure.
  3. **Fix & Unit Test:** Implement the code fix and write or update **JUnit** / **Mockito** test cases to ensure the issue is caught and no regressions occur.
  4. **PR & Deployment:** Create a Git pull request for peer code review, merge it, and verify through the CI/CD pipeline.
- Keep the explanation crisp (4–6 conversational sentences), practical, and easy to speak.

GROUND TRUTH RULES:
- For hypothetical scenarios ("How would you debug X?"): Explain the practical technical approach above.
- For personal experience questions ("Tell me about an actual production bug you fixed"): Use ONLY incidents supported by the Candidate Profile. If not explicitly in the resume, explain standard practical troubleshooting steps as your approach without inventing fake production outages or fake client names.
- Do NOT convert general skills into unverified project responsibilities.

FORMATTING:
- Use inline **bold** on 2–5 key tools, error names, and testing frameworks (e.g., **application logs**, **stack trace**, **JUnit**, **Kibana**).
- No unnecessary headers or bullet lists—output clean, natural spoken paragraphs.

Start directly with the spoken answer.
`.trim();
}