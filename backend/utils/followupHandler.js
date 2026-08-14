
const SHORT_FOLLOW_UPS = [
  "why?",
  "how?",
  "then?",
  "next?",
  "what next?",
  "and then?",
  "why is that?",
  "how so?",
  "what about it?",
  "what about that?",
  "what do you mean?",
  "can you explain?",
  "can you elaborate?",
  "and why?",
  "and how?",
];

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
];

function normalizeQuestion(question = "") {
  return String(question)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function isFollowUpQuestion(question = "") {
  const q = normalizeQuestion(question);

  if (!q) return false;

  if (SHORT_FOLLOW_UPS.includes(q)) {
    return true;
  }

  return FOLLOW_UP_PATTERNS.some((pattern) => {
    return (
      q === pattern ||
      q.startsWith(`${pattern} `) ||
      q.includes(` ${pattern} `) ||
      q.endsWith(` ${pattern}`)
    );
  });
}

export function isShortInterviewQuestion(question = "") {
  const q = normalizeQuestion(question);

  if (!q) return false;

  return q.split(" ").length <= 6;
}

export function getRecentConversationHistory(history = [], limit = 6) {
  if (!Array.isArray(history) || history.length === 0) {
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

      const role =
        item.role === "assistant" || item.role === "candidate"
          ? "Candidate"
          : "Interviewer";

      const content = String(item.content || "").trim();

      if (!content) {
        return "";
      }

      return `${role}: ${content}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function buildInterviewContext(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      previousQuestion: "",
      previousAnswer: "",
      historyText: "",
      questionAnswerCount: 0,
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

  const questionAnswerCount = countQuestionAnswerPairs(recentHistory);

  return {
    previousQuestion,
    previousAnswer,
    historyText: buildConversationHistory(recentHistory, 6),
    questionAnswerCount,
  };
}

function countQuestionAnswerPairs(history = []) {
  if (!Array.isArray(history)) {
    return 0;
  }

  let questions = 0;
  let answers = 0;

  for (const item of history) {
    if (!item || typeof item !== "object") {
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

  return Math.min(questions, answers);
}

export function hasEnoughFollowUpContext(history = []) {
  return countQuestionAnswerPairs(
    getRecentConversationHistory(history, 6)
  ) >= 3;
}

export function buildFollowUpPrompt({
  question,
  historyText = "",
}) {
  return `
You are the candidate in a live technical interview.

Recent interview conversation:

${historyText}

Current interviewer question:
"${question}"

Continue the conversation naturally.

Use the previous conversation only to understand what the interviewer is referring to.

If this is a follow-up, answer only the new point.

Do not repeat the previous answer.

Do not restart the topic.

If the current question is a new topic, answer the current question normally.

Use the candidate profile already provided in the system prompt.

Never invent experience, projects, technologies, responsibilities, incidents, or achievements.

Speak naturally like an experienced Indian software professional in a live interview.

Keep the answer short, clear, direct, and easy to speak.

Do not sound scripted or like AI.

Do not use phrases like:
"Certainly"
"Additionally"
"Furthermore"
"Moreover"
"In conclusion"
"Let me elaborate"
"According to my profile"
"Based on my experience"

Do not teach.

Do not write documentation.

Do not add headings.

Do not add titles.

Do not add emojis.

Return only the answer the candidate should speak.

Start immediately.
`;
}