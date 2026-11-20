import { classifyQuestion } from "./questionClassifier.js";

import { buildSelfIntroductionPrompt } from "../prompts/selfIntroPrompt.js";
import { buildConceptPrompt } from "../prompts/conceptPrompt.js";
import { buildScenarioPrompt } from "../prompts/scenarioPrompt.js";
import { buildArchitecturePrompt } from "../prompts/architecturePrompt.js";
import { buildCodingPrompt } from "../prompts/codingPrompt.js";
import { buildProjectPrompt } from "../prompts/projectPrompt.js";

export function buildPrompt({
  question,
  interviewLevel = "",
  company = "",
  interviewType = "",
  candidateRole = "",
}) {
  const cleanQuestion = String(question || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!cleanQuestion) {
    return "";
  }

  const questionType = classifyQuestion(cleanQuestion);

  const payload = {
    question: cleanQuestion,
    questionType,
    interviewLevel,
    company,
    interviewType,
    candidateRole,
  };

  switch (questionType) {
    case "SELF_INTRO":
      return buildSelfIntroductionPrompt(payload);

    case "CODING":
      return buildCodingPrompt(payload);

    case "PROJECT":
      return buildProjectPrompt(payload);

    case "SCENARIO":
      return buildScenarioPrompt(payload);

    case "ARCHITECTURE":
      return buildArchitecturePrompt(payload);

    case "CONCEPT":
    default:
      return buildConceptPrompt(payload);
  }
}