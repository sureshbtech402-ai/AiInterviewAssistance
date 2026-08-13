/**
 * utils/followupHandler.js
 *
 * Utilities for detecting and preparing interview follow-up
 * questions.
 *
 * IMPORTANT:
 * This file does NOT decide the complete interview context by
 * itself. Keyword detection is only a lightweight signal.
 *
 * The backend should eventually combine:
 *
 *   Current Question
 *        +
 *   Recent Interview Context
 *        +
 *   Candidate Profile
 *
 * to determine whether a question is actually a follow-up.
 */

/**
 * Phrases that commonly indicate a follow-up question.
 *
 * These are intentionally kept as signals rather than absolute
 * rules because a word such as "how", "why", or "difference"
 * can also appear in a completely new interview question.
 */
const FOLLOW_UP_PATTERNS = [
  "why",
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
  "why is it",
  "why was that",
  "why did you",
  "how did you",
  "how do you",
  "how would you",
  "can you elaborate",
  "can you explain",
  "what do you mean",
  "what about that",
];

/**
 * Very short questions are often follow-ups when they depend
 * heavily on the previous answer.
 */
const SHORT_FOLLOW_UP_PATTERNS = [
  "why?",
  "how?",
  "then?",
  "what next?",
  "and then?",
  "why is that?",
  "what about it?",
  "how so?",
  "what do you mean?",
  "can you explain?",
  "can you elaborate?",
  "and why?",
  "and how?",
];

/**
 * Normalize a question before performing lightweight checks.
 */
function normalizeQuestion(question = "") {
  return String(question)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Detect whether a question contains a common follow-up signal.
 *
 * IMPORTANT:
 * This is NOT a final semantic follow-up detector.
 *
 * For example:
 *
 * "How does Spring Boot work?"
 *
 * contains "how", but may be a completely new question.
 *
 * Therefore the backend should use this function only as one signal
 * and should combine it with conversation context.
 */
export function isFollowUpQuestion(question = "") {
  const q = normalizeQuestion(question);

  if (!q) return false;

  /**
   * Exact short follow-up questions.
   */
  if (SHORT_FOLLOW_UP_PATTERNS.includes(q)) {
    return true;
  }

  /**
   * Strong multi-word follow-up patterns.
   *
   * These are safer than checking generic words such as "how"
   * or "why" everywhere in the question.
   */
  const strongPatterns = FOLLOW_UP_PATTERNS.filter(
    (pattern) =>
      pattern.includes(" ") ||
      pattern === "then" ||
      pattern === "next" ||
      pattern === "continue" ||
      pattern === "go on" ||
      pattern === "explain" ||
      pattern === "example" ||
      pattern === "internally" ||
      pattern === "flow"
  );

  return strongPatterns.some((pattern) => {
    return (
      q === pattern ||
      q.startsWith(`${pattern} `) ||
      q.includes(` ${pattern} `) ||
      q.endsWith(` ${pattern}`)
    );
  });
}

/**
 * Determine whether a question is very short.
 *
 * Short questions such as:
 *
 * "Why?"
 * "How?"
 * "And then?"
 * "What about that?"
 *
 * usually require the previous conversation to understand their
 * meaning.
 */
export function isShortInterviewQuestion(question = "") {
  const q = normalizeQuestion(question);

  if (!q) return false;

  const words = q.split(" ");

  return words.length <= 6;
}

/**
 * Get the most recent interview messages.
 *
 * We intentionally keep the context small to reduce prompt size
 * and latency.
 *
 * The backend can later replace this with structured interview
 * memory instead of sending raw messages.
 */
export function getRecentConversationHistory(history = [], limit = 6) {
  if (!Array.isArray(history) || history.length === 0) {
    return [];
  }

  const safeLimit = Math.max(1, Number(limit) || 6);

  return history.slice(-safeLimit);
}

/**
 * Build a compact conversation history for the AI.
 *
 * Only the most recent relevant conversation should normally be
 * sent to the model.
 */
export function buildConversationHistory(history = [], limit = 6) {
  const recentHistory = getRecentConversationHistory(history, limit);

  if (recentHistory.length === 0) {
    return "";
  }

  return recentHistory
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }

      const role =
        item.role === "assistant" ||
        item.role === "candidate"
          ? "Candidate"
          : "Interviewer";

      const content = String(item.content || "").trim();

      if (!content) {
        return "";
      }

      return `${role}: ${content}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Build a compact interview context object.
 *
 * This is useful for the backend because we eventually want to
 * distinguish:
 *
 * - Previous question
 * - Previous answer
 * - Current topic
 * - Current question
 *
 * instead of blindly sending a large conversation history.
 */
export function buildInterviewContext(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      previousQuestion: "",
      previousAnswer: "",
      historyText: "",
    };
  }

  const recentHistory = getRecentConversationHistory(history, 6);

  let previousQuestion = "";
  let previousAnswer = "";

  for (let i = recentHistory.length - 1; i >= 0; i--) {
    const item = recentHistory[i];

    if (!item || typeof item !== "object") {
      continue;
    }

    const content = String(item.content || "").trim();

    if (!content) {
      continue;
    }

    if (
      !previousAnswer &&
      (item.role === "assistant" || item.role === "candidate")
    ) {
      previousAnswer = content;
      continue;
    }

    if (!previousQuestion && item.role === "user") {
      previousQuestion = content;
    }

    if (previousQuestion && previousAnswer) {
      break;
    }
  }

  return {
    previousQuestion,
    previousAnswer,
    historyText: buildConversationHistory(recentHistory, 6),
  };
}

/**
 * Build the prompt used when a question is determined to be a
 * follow-up.
 *
 * IMPORTANT:
 * This prompt assumes that the backend has already supplied the
 * relevant previous conversation.
 */
export function buildFollowUpPrompt({
  question,
  historyText = "",
  previousQuestion = "",
  previousAnswer = "",
}) {
  return `
You are the candidate in a LIVE technical interview.

The interviewer has asked a follow-up question.

==================================================
PREVIOUS INTERVIEW CONTEXT
==================================================

Previous Question:

"${previousQuestion || "Not available"}"

Previous Candidate Answer:

"${previousAnswer || "Not available"}"

Recent Conversation:

${historyText || "No previous conversation available."}

==================================================
CURRENT QUESTION
==================================================

The interviewer now asks:

"${question}"

==================================================
YOUR ROLE
==================================================

Answer exactly what the candidate should say to the interviewer
RIGHT NOW.

You are NOT a teacher.

You are NOT a trainer.

You are NOT writing documentation.

You are NOT explaining the entire previous topic again.

You are continuing the live conversation naturally.

==================================================
FOLLOW-UP RULE
==================================================

Treat the current question as a continuation of the previous
discussion when the context supports that interpretation.

Answer ONLY the new point raised by the interviewer.

Do NOT repeat information that was already explained.

Do NOT restart the previous answer.

Do NOT summarize the previous conversation.

==================================================
ANSWER DEPTH
==================================================

Keep the answer as short as possible while still completely
answering the current question.

If one or two sentences are enough, stop.

If the interviewer asks for more detail, provide more detail.

If the interviewer asks "why", answer the reason.

If the interviewer asks "how", explain how.

If the interviewer asks "what if", address the new condition.

If the interviewer asks for an example, provide only the relevant
example.

==================================================
CANDIDATE EXPERIENCE
==================================================

When the follow-up refers to the candidate's own experience,
remain consistent with the candidate profile and previous
conversation.

Never invent:

- Projects
- Companies
- Technologies
- Responsibilities
- Production incidents
- Metrics
- Achievements
- Experience

If the previous answer contained an unsupported claim, do not expand
that claim further.

==================================================
LANGUAGE
==================================================

Speak in natural Indian professional spoken English.

Be:

- Natural
- Clear
- Confident
- Conversational
- Direct
- Easy to speak aloud

Use first person naturally when discussing the candidate's own
experience.

Do not intentionally use broken English.

Do not sound formal or scripted.

==================================================
DO NOT SOUND LIKE AI
==================================================

Do not use phrases such as:

"Certainly, I'd be happy to explain."

"Let me elaborate."

"According to my resume."

"Based on my profile."

"The candidate."

"Furthermore."

"Additionally."

"Moreover."

"In conclusion."

"Hence."

"Utilize."

"Leverage."

==================================================
OUTPUT
==================================================

Return ONLY the interview answer.

No headings.

No markdown.

No emojis.

No titles.

No explanations about these instructions.

Do not say:

"Here is the answer."

"You can say..."

"Your answer could be..."

Start answering immediately.

==================================================
FINAL RULE
==================================================

Answer the CURRENT question.

Use the previous conversation only to understand what the
interviewer is referring to.

Do not repeat the previous answer.

Do not over-explain.

Speak naturally.

STOP when the follow-up has been answered.
`;
}