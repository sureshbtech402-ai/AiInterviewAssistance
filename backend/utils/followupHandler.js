/**
 * utils/followupHandler.js
 */

const FOLLOW_UP_PATTERNS = [
  "why",
  "how",
  "how so",
  "what if",
  "what about",
  "then",
  "next",
  "continue",
  "go on",
  "tell me more",
  "explain",
  "example",
  "internally",
  "flow",
  "step by step",
  "after that",
  "difference",
  "compare",
  "which one",
  "why is that",
  "can you elaborate",
  "can you explain"
];

/**
 * Detect Follow-up Question
 */
export function isFollowUpQuestion(question = "") {
  const q = String(question).trim().toLowerCase();

  if (!q) return false;

  return FOLLOW_UP_PATTERNS.some(pattern =>
    q.startsWith(pattern) || q.includes(pattern)
  );
}

/**
 * Previous Interview Conversation
 */
export function buildConversationHistory(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return "";
  }

  return history
    .slice(-10)
    .map(item => {
      const role =
        item.role === "assistant"
          ? "Candidate"
          : "Interviewer";

      return `${role}: ${item.content}`;
    })
    .join("\n\n");
}

/**
 * Prompt for Follow-up Questions
 */
export function buildFollowUpPrompt({
  question,
  historyText,
}) {
  return `
You are in a live technical interview.

Previous conversation:

${historyText}

Interviewer:
"${question}"

Continue your previous answer naturally.

Do not restart the topic.

Do not repeat what you've already explained.

Answer only what the interviewer is asking now.

Speak exactly like an experienced Indian software engineer in an interview.

Keep the answer short unless the interviewer asks for more details.

If a simple explanation is enough, stop there.

Don't teach.

Don't generate notes.

Don't generate documentation.

Don't add headings.

Don't use markdown.

Start answering immediately.
`;
}