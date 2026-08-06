// utils/followupHandler.js

/**
 * Detect whether the current question
 * is a follow-up to the previous interview question.
 */

const FOLLOW_UP_PATTERNS = [
  "why",
  "how",
  "what if",
  "what about",
  "then",
  "next",
  "continue",
  "more",
  "explain",
  "example",
  "difference",
  "compare",
  "internally",
  "flow",
  "step by step"
];

/**
 * Returns true if the question looks like
 * a follow-up question.
 */
export function isFollowUpQuestion(question = "") {
  const q = question.toLowerCase().trim();

  if (!q) {
    return false;
  }

  return FOLLOW_UP_PATTERNS.some(pattern => q.includes(pattern));
}

/**
 * Builds conversation history.
 *
 * NOTE:
 * buildPrompt.js already sends only the
 * last 9 interview turns.
 *
 * So do NOT slice history here again.
 */
export function buildConversationHistory(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return "";
  }

  return history
    .map(item => {
      const role =
        item.role === "assistant"
          ? "Assistant"
          : "User";

      return `${role}: ${item.content}`;
    })
    .join("\n\n");
}

/**
 * Builds GPT follow-up prompt.
 */
export function buildFollowUpPrompt({
  question,
  historyText
}) {
  return `
=========================
PREVIOUS CONVERSATION
=========================

${historyText}

=========================
FOLLOW-UP QUESTION
=========================

${question}

=========================
INSTRUCTIONS
=========================

The interviewer has asked a follow-up question.

Continue naturally from the previous answer.

Do NOT restart the topic.

Do NOT repeat information already explained.

Answer ONLY what the interviewer is asking now.

If asked "Why", explain only the reason.

If asked "How", explain only the implementation or process.

If asked for an example, provide one practical real-world example.

If asked for a comparison, compare only the requested concepts.

Keep the conversation natural.

Use simple Indian spoken English.

Sound like a real software engineer answering in a live interview.
`;
}