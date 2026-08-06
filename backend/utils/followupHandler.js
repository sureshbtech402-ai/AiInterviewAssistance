/**
 * utils/followupHandler.js
 */

const FOLLOW_UP_PATTERNS = [
  "why",
  "how",
  "how so",
  "how exactly",
  "what if",
  "what about",
  "then",
  "next",
  "continue",
  "go on",
  "tell me more",
  "can you explain",
  "explain more",
  "give an example",
  "example",
  "internally",
  "flow",
  "step by step",
  "after that",
  "and then",
  "difference",
  "compare",
  "which one",
  "why is that"
];

/**
 * Detects whether the current question
 * is a follow-up to the previous question.
 */
export function isFollowUpQuestion(question = "") {
  const q = question.trim().toLowerCase();

  if (!q) {
    return false;
  }

  return FOLLOW_UP_PATTERNS.some((pattern) =>
    q.startsWith(pattern) || q.includes(pattern)
  );
}

/**
 * Builds previous conversation.
 */
export function buildConversationHistory(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return "";
  }

  return history
    .map((item) => {
      const role =
        item.role === "assistant"
          ? "Candidate"
          : "Interviewer";

      return `${role}: ${item.content}`;
    })
    .join("\n\n");
}

/**
 * Prompt for follow-up questions.
 */
export function buildFollowUpPrompt({
  question,
  historyText,
}) {
  return `
==================================================
LIVE INTERVIEW
==================================================

Previous Conversation

${historyText}

==================================================
FOLLOW-UP QUESTION
==================================================

"${question}"

==================================================
YOUR ROLE
==================================================

You ARE the candidate.

The interviewer has asked a follow-up question.

Continue naturally from your previous answer.

Do NOT restart the topic.

Do NOT repeat information already explained.

Answer ONLY the newly asked part.

==================================================
HOW TO ANSWER
==================================================

If asked

"Why"

→ Explain only the reason.

If asked

"How"

→ Explain only the implementation or internal working.

If asked

"Difference"

→ Compare only those two things.

If asked

"Example"

→ Give only one simple practical example.

If asked

"Internally"

→ Explain the internal flow step by step.

If asked

"What if"

→ Explain how you would handle that situation.

Keep the same interview context.

Do not change the topic unless the interviewer changes it.

==================================================
STYLE
==================================================

✔ Natural Indian spoken English.

✔ Interview style.

✔ Human.

✔ Confident.

✔ Short.

✔ Conversational.

Do not sound like ChatGPT.

Do not generate documentation.

Do not generate unnecessary headings.

Return ONLY the interview answer.

Start answering immediately.
`;
}