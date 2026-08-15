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
  "write syntax",
  "give syntax",
  "write code",
  "give code",
  "show code",
  "can you code it",
]);

const FOLLOW_UP_PATTERNS = [
  "what about",
  "what if",
  "tell me more",
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
  "can you explain",
  "can you elaborate",
  "what do you mean",
  "write syntax for",
  "give me syntax for",
  "write code for",
  "give me code for",
  "show me the code",
  "can you write the code",
  "can you write syntax",
];

function normalizeQuestion(question = "") {
  return String(question || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ") // Cleanly strips punctuation
    .replace(/\s+/g, " ")
    .trim();
}

export function isFollowUpQuestion(question = "") {
  const q = normalizeQuestion(question);

  if (!q) {
    return false;
  }

  if (SHORT_FOLLOW_UPS.has(q)) {
    return true;
  }

  return FOLLOW_UP_PATTERNS.some((pattern) =>
    q === pattern ||
    q.startsWith(`${pattern} `) ||
    q.includes(` ${pattern} `) ||
    q.endsWith(` ${pattern}`)
  );
}

export function isShortInterviewQuestion(question = "") {
  const q = normalizeQuestion(question);
  return q ? q.split(" ").length <= 8 : false;
}

export function getRecentConversationHistory(history = [], limit = 6) {
  if (!Array.isArray(history)) {
    return [];
  }

  const safeLimit = Math.max(1, Number(limit) || 6);
  return history.slice(-safeLimit);
}

export function buildConversationHistory(history = [], limit = 6) {
  const recentHistory = getRecentConversationHistory(history, limit);

  if (!recentHistory.length) {
    return "";
  }

  return recentHistory
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }

      const content = String(item.content || "").trim();
      if (!content) {
        return "";
      }

      const role =
        item.role === "assistant" || item.role === "candidate"
          ? "Candidate"
          : "Interviewer";

      return `${role}: ${content}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function buildInterviewContext(history = []) {
  const recentHistory = getRecentConversationHistory(history, 6);

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

  for (let i = recentHistory.length - 1; i >= 0; i--) {
    const item = recentHistory[i];

    if (!item || !item.content) {
      continue;
    }

    const content = String(item.content).trim();

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
    historyText: buildConversationHistory(recentHistory),
    questionAnswerCount: countQuestionAnswerPairs(recentHistory),
  };
}

function countQuestionAnswerPairs(history = []) {
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

    if (item.role === "assistant" || item.role === "candidate") {
      answers++;
    }
  }

  return Math.min(questions, answers);
}

export function hasEnoughFollowUpContext(history = []) {
  return (
    countQuestionAnswerPairs(getRecentConversationHistory(history)) >= 1
  );
}