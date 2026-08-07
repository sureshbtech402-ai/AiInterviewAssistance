import { classifyQuestion } from "./questionClassifier.js";
import {
  isFollowUpQuestion,
  buildConversationHistory,
  buildFollowUpPrompt,
} from "./followupHandler.js";

import { buildSelfIntroductionPrompt } from "../prompts/selfIntroPrompt.js";
import { buildConceptPrompt } from "../prompts/conceptPrompt.js";
import { buildScenarioPrompt } from "../prompts/scenarioPrompt.js";
import { buildArchitecturePrompt } from "../prompts/architecturePrompt.js";
import { buildCodingPrompt } from "../prompts/codingPrompt.js";

export function buildPrompt({
  question,
  history = [],
  interviewLevel,
  company,
  interviewType,
}) {
  const cleanQuestion = String(question || "").trim();

  if (!cleanQuestion) {
    return "";
  }

  // ======================================
  // Follow-up Question
  // ======================================

  if (
    history.length &&
    isFollowUpQuestion(cleanQuestion)
  ) {
    return buildFollowUpPrompt({
      question: cleanQuestion,
      historyText: buildConversationHistory(
        history.slice(-10)
      ),
    });
  }

  // ======================================
  // Detect Interview Question Type
  // ======================================

  const questionType = classifyQuestion(cleanQuestion);

  const payload = {
    question: cleanQuestion,
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