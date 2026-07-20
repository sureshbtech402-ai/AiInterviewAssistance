// utils/promptBuilder.js

import { classifyQuestion } from "./questionClassifier.js";
import {
  isFollowUpQuestion,
  buildConversationHistory,
  buildFollowUpPrompt
} from "./followupHandler.js";

import { buildSelfIntroductionPrompt } from "../prompts/selfIntroPrompt.js";
import { buildConceptPrompt } from "../prompts/conceptPrompt.js";
import { buildScenarioPrompt } from "../prompts/scenarioPrompt.js";
import { buildArchitecturePrompt } from "../prompts/architecturePrompt.js";
import { buildCodingPrompt } from "../prompts/codingPrompt.js";

/**
 * Creates the final prompt that will be sent to GPT.
 */

export function buildPrompt({

  question,

  resumeText,

  history = [],

  interviewLevel,

  company,

  interviewType

}) {

  // -----------------------------
  // Follow-up Question
  // -----------------------------

  if (history.length > 0 && isFollowUpQuestion(question)) {

    const historyText = buildConversationHistory(history);

    return buildFollowUpPrompt({

      question,

      historyText

    });

  }

  // -----------------------------
  // Classify Question
  // -----------------------------

  const questionType = classifyQuestion(question);

  switch (questionType) {

    case "SELF_INTRO":

      return buildSelfIntroductionPrompt({

        question,

        resumeText,

        interviewLevel,

        company,

        interviewType

      });

    case "ARCHITECTURE":

      return buildArchitecturePrompt({

        question,

        resumeText,

        interviewLevel,

        company,

        interviewType

      });

    case "SCENARIO":

      return buildScenarioPrompt({

        question,

        resumeText,

        interviewLevel,

        company,

        interviewType

      });

    case "CODING":

      return buildCodingPrompt({

        question,

        resumeText,

        interviewLevel,

        company,

        interviewType

      });

    case "CONCEPT":

    default:

      return buildConceptPrompt({

        question,

        resumeText,

        interviewLevel,

        company,

        interviewType

      });

  }

}