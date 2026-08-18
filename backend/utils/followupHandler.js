// ==================================================
// QUESTION NORMALIZATION
// ==================================================

function normalizeQuestion(question = "") {
  return String(question || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


// ==================================================
// FOLLOW-UP DETECTION
// ==================================================

const SHORT_FOLLOW_UPS = new Set([
  "why",
  "how",
  "then",
  "next",
  "what next",
  "and then",
  "why is that",
  "how so",
  "what about that",
  "what do you mean",
  "can you explain",
  "can you elaborate",
  "and why",
  "and how",
]);

const FOLLOW_UP_PATTERNS = [
  "what about",
  "what if",
  "tell me more",
  "tell me more about that",
  "go on",
  "continue",
  "after that",
  "why is that",
  "why is it",
  "why was that",
  "why did you",
  "how did you",
  "how do you",
  "how would you",
  "what do you mean by that",
  "can you explain that",
  "can you elaborate on that",
];

export function isFollowUpQuestion(question = "") {
  const q = normalizeQuestion(question);

  if (!q) {
    return false;
  }

  if (SHORT_FOLLOW_UPS.has(q)) {
    return true;
  }

  return FOLLOW_UP_PATTERNS.some(
    (pattern) =>
      q === pattern ||
      q.startsWith(`${pattern} `) ||
      q.includes(` ${pattern} `) ||
      q.endsWith(` ${pattern}`)
  );
}


// ==================================================
// SHORT INTERVIEW QUESTION
// ==================================================

export function isShortInterviewQuestion(question = "") {
  const q = normalizeQuestion(question);

  if (!q) {
    return false;
  }

  return q.split(" ").length <= 8;
}


// ==================================================
// RECENT HISTORY
// ==================================================

// Keep a small amount of history so follow-ups have
// enough context without unnecessarily increasing
// prompt size and latency.

export function getRecentConversationHistory(
  history = [],
  limit = 4
) {
  if (!Array.isArray(history)) {
    return [];
  }

  const safeLimit = Math.max(
    1,
    Number(limit) || 4
  );

  return history
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        String(item.content || "").trim()
    )
    .slice(-safeLimit);
}


// ==================================================
// BUILD SIMPLE CONVERSATION HISTORY
// ==================================================

export function buildConversationHistory(
  history = [],
  limit = 4
) {
  const recentHistory =
    getRecentConversationHistory(history, limit);

  if (!recentHistory.length) {
    return "";
  }

  return recentHistory
    .map((item) => {
      const content =
        String(item.content || "").trim();

      if (!content) {
        return "";
      }

      const role =
        item.role === "assistant" ||
        item.role === "candidate"
          ? "Candidate"
          : "Interviewer";

      return `${role}: ${content}`;
    })
    .filter(Boolean)
    .join("\n");
}


// ==================================================
// INTERVIEW CONTEXT
// ==================================================

export function buildInterviewContext(
  history = []
) {
  const recentHistory =
    getRecentConversationHistory(history, 4);

  if (!recentHistory.length) {
    return {
      previousQuestion: "",
      previousAnswer: "",
      historyText: "",
      questionAnswerCount: 0,
    };
  }

  let previousQuestion = "";
  let previousAnswer = "";

  // Find the most recent candidate answer.
  for (
    let i = recentHistory.length - 1;
    i >= 0;
    i--
  ) {
    const item = recentHistory[i];

    if (!item || !item.content) {
      continue;
    }

    const content =
      String(item.content).trim();

    if (
      !previousAnswer &&
      (
        item.role === "assistant" ||
        item.role === "candidate"
      )
    ) {
      previousAnswer = content;
      continue;
    }

    if (
      !previousQuestion &&
      item.role === "user"
    ) {
      previousQuestion = content;
    }

    if (
      previousQuestion &&
      previousAnswer
    ) {
      break;
    }
  }

  return {
    previousQuestion,
    previousAnswer,
    historyText:
      buildConversationHistory(
        recentHistory,
        4
      ),
    questionAnswerCount:
      countQuestionAnswerPairs(
        recentHistory
      ),
  };
}


// ==================================================
// COUNT QUESTION / ANSWER PAIRS
// ==================================================

function countQuestionAnswerPairs(
  history = []
) {
  if (!Array.isArray(history)) {
    return 0;
  }

  let questions = 0;
  let answers = 0;

  for (const item of history) {
    if (!item) {
      continue;
    }

    if (item.role === "user") {
      questions++;
    }

    if (
      item.role === "assistant" ||
      item.role === "candidate"
    ) {
      answers++;
    }
  }

  return Math.min(
    questions,
    answers
  );
}


// ==================================================
// CHECK WHETHER FOLLOW-UP CONTEXT EXISTS
// ==================================================

export function hasEnoughFollowUpContext(
  history = []
) {
  return (
    countQuestionAnswerPairs(
      getRecentConversationHistory(
        history,
        4
      )
    ) >= 1
  );
}