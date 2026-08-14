import { classifyQuestion } from "./questionClassifier.js";

import { buildInterviewContext } from "./followupHandler.js";

import { buildSelfIntroductionPrompt } from "../prompts/selfIntroPrompt.js";
import { buildConceptPrompt } from "../prompts/conceptPrompt.js";
import { buildScenarioPrompt } from "../prompts/scenarioPrompt.js";
import { buildArchitecturePrompt } from "../prompts/architecturePrompt.js";
import { buildCodingPrompt } from "../prompts/codingPrompt.js";

export function buildPrompt({
  question,
  history = [],
  interviewLevel = "",
  company = "",
  interviewType = "",
}) {
  const cleanQuestion = String(question || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!cleanQuestion) {
    return "";
  }

  const safeHistory = Array.isArray(history) ? history : [];

  const {
    historyText = "",
  } = buildInterviewContext(safeHistory);

  const questionType = classifyQuestion(cleanQuestion);

  const payload = {
    question: cleanQuestion,
    historyText,
    interviewLevel,
    company,
    interviewType,
  };

  switch (questionType) {
    case "SELF_INTRO":
      return buildSelfIntroductionPrompt(payload);

    case "ARCHITECTURE":
      return buildArchitecturePrompt(payload);

    case "SCENARIO":
      return buildScenarioPrompt(payload);

    case "CODING":
      return buildCodingPrompt(payload);

    case "CONCEPT":
    default:
      return buildConceptPrompt(payload);
  }
}