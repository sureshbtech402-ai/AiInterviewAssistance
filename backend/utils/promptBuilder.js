import { classifyQuestion } from "./questionClassifier.js";

import {
  isFollowUpQuestion,
  isShortInterviewQuestion,
  buildInterviewContext,
  buildFollowUpPrompt,
} from "./followupHandler.js";

import { buildSelfIntroductionPrompt } from "../prompts/selfIntroPrompt.js";
import { buildConceptPrompt } from "../prompts/conceptPrompt.js";
import { buildScenarioPrompt } from "../prompts/scenarioPrompt.js";
import { buildArchitecturePrompt } from "../prompts/architecturePrompt.js";
import { buildCodingPrompt } from "../prompts/codingPrompt.js";

/**
 * Build the prompt for a live interview question.
 *
 * IMPORTANT:
 * This function is intentionally lightweight.
 *
 * The candidate profile should be supplied once at the model/system
 * level by the backend rather than repeatedly duplicated here.
 *
 * The current question should remain the main input for every turn.
 */
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

  // ==================================================
  // INTERVIEW CONTEXT
  // ==================================================

  const interviewContext = buildInterviewContext(safeHistory);

  const {
    previousQuestion = "",
    previousAnswer = "",
    historyText = "",
  } = interviewContext;

  // ==================================================
  // FOLLOW-UP DETECTION
  // ==================================================
  //
  // Follow-up detection is only a lightweight signal.
  //
  // We do NOT treat every "why" or "how" question as a follow-up.
  //
  // A follow-up is much more likely when:
  //
  // 1. Previous interview context exists
  // 2. The current question has a follow-up signal
  // 3. The question is short/context-dependent
  //
  // The backend can later add stronger semantic detection.
  // ==================================================

  const hasPreviousContext =
    Boolean(previousQuestion) || Boolean(previousAnswer);

  const followUpSignal =
    isFollowUpQuestion(cleanQuestion);

  const shortQuestion =
    isShortInterviewQuestion(cleanQuestion);

  const shouldUseFollowUp =
    hasPreviousContext &&
    followUpSignal &&
    (
      shortQuestion ||
      Boolean(previousQuestion)
    );

  if (shouldUseFollowUp) {
    return buildFollowUpPrompt({
      question: cleanQuestion,
      previousQuestion,
      previousAnswer,
      historyText,
    });
  }

  // ==================================================
  // QUESTION CLASSIFICATION
  // ==================================================

  const questionType = classifyQuestion(cleanQuestion);

  // ==================================================
  // COMMON PAYLOAD
  // ==================================================

  const payload = {
    question: cleanQuestion,
    interviewLevel,
    company,
    interviewType,
  };

  // ==================================================
  // QUESTION ROUTING
  // ==================================================

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