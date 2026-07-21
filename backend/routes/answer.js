import express from "express";

import { getProfile, hasResume } from "../store/resumeStore.js";
import { buildInterviewMessages } from "../prompts/interviewPrompt.js";
import { streamOpenAI } from "../services/openaiService.js";
import { pipeOpenAIStream } from "../utils/openaiStream.js";
import {
  addUserMessage,
  addAssistantMessage,
  getHistory,
} from "../utils/history.js";
import { getCleanQuestion } from "../utils/question.js";

const router = express.Router();

router.post("/answer", async (req, res) => {
  try {
    const sessionId = req.headers["x-session-id"];

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Missing x-session-id header.",
      });
    }

    if (!hasResume(sessionId)) {
      return res.status(404).json({
        success: false,
        message: "Resume session expired. Upload the resume again.",
      });
    }

    const cleanQuestion = getCleanQuestion(req.body?.question);

    if (!cleanQuestion) {
      return res.status(400).json({
        success: false,
        message: "Question is required.",
      });
    }

    const profile = getProfile(sessionId);
    const history = getHistory(sessionId, 8);

    const messages = buildInterviewMessages({
      question: cleanQuestion,
      profile,
      history,
    });

    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.flushHeaders?.();

    const stream = await streamOpenAI(messages);
    const completeAnswer = await pipeOpenAIStream(stream, res);

    addUserMessage(sessionId, cleanQuestion);
    addAssistantMessage(sessionId, completeAnswer);
  } catch (error) {
    console.error("Answer route error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message || "Unable to generate answer.",
      });
    }

    res.end();
  }
});

export default router;
