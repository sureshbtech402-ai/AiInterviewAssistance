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
  resumeProfileContext,
  history = [],
  interviewLevel,
  company,
  interviewType,
}) {
  const cleanQuestion = String(question || "").trim();

  const profileContext = String(
    resumeProfileContext || ""
  ).trim();

  // ----------------------------
  // Follow-up Question
  // ----------------------------
  if (
    cleanQuestion &&
    history.length &&
    isFollowUpQuestion(cleanQuestion)
  ) {
    const historyText = buildConversationHistory(
      history.slice(-9)
    );

    return buildFollowUpPrompt({
      question: cleanQuestion,
      historyText,
      resumeProfileContext: profileContext,
    });
  }

  // ----------------------------
  // Detect Question Type
  // ----------------------------
  const questionType = classifyQuestion(cleanQuestion);

  const commonPayload = {
    question: cleanQuestion,
    resumeProfileContext: profileContext,
    interviewLevel,
    company,
    interviewType,
  };

  switch (questionType) {
    case "SELF_INTRO":
      return buildSelfIntroductionPrompt(commonPayload);

    case "ARCHITECTURE":
      return buildArchitecturePrompt(commonPayload);

    case "SCENARIO":
      return buildScenarioPrompt(commonPayload);

    case "CODING":
      return buildCodingPrompt(commonPayload);

    case "CONCEPT":
    default:
      return buildConceptPrompt(commonPayload);
  }
}