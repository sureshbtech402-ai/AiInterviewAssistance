import express from "express";

import { getProfile } from "../store/resumeStore.js";
import { buildInterviewMessages } from "../prompts/interviewPrompt.js";
import { streamOpenAI } from "../services/openaiService.js";
import { pipeOpenAIStream } from "../utils/openaiStream.js";

import {
  addUserMessage,
  addAssistantMessage,
  getHistory
} from "../utils/history.js";

import { getCleanQuestion } from "../utils/question.js";

const router = express.Router();

router.post("/answer", async (req, res) => {
  try {

    //---------------------------------
    // Session Id
    //---------------------------------

    const sessionId = req.headers["x-session-id"];

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Missing x-session-id header."
      });
    }

    //---------------------------------
    // Question
    //---------------------------------

    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: "Question is required."
      });
    }

    const cleanQuestion = getCleanQuestion(question);

    //---------------------------------
    // Resume
    //---------------------------------

    const profile = getProfile(sessionId);

    //---------------------------------
    // Previous Conversation
    //---------------------------------

    const history = getHistory(sessionId);

    //---------------------------------
    // Build Prompt
    //---------------------------------

    const messages = buildInterviewMessages({
      question: cleanQuestion,
      profile,
      history
    });

    //---------------------------------
    // SSE Headers
    //---------------------------------

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    //---------------------------------
    // OpenAI Stream
    //---------------------------------

    const stream = await streamOpenAI(messages);

    let completeAnswer = "";

    const originalWrite = res.write.bind(res);

    res.write = (chunk) => {
      try {

        const text = chunk.toString();

        if (
          text.startsWith("data:") &&
          !text.includes("[DONE]")
        ) {

          const json = JSON.parse(
            text.replace("data:", "").trim()
          );

          if (json.text) {
            completeAnswer += json.text;
          }

        }

      } catch (err) {
        // Ignore parsing errors
      }

      return originalWrite(chunk);
    };

    //---------------------------------
    // Send Stream to React
    //---------------------------------

    await pipeOpenAIStream(stream, res);

    //---------------------------------
    // Save Conversation
    //---------------------------------

    addUserMessage(sessionId, cleanQuestion);
    addAssistantMessage(sessionId, completeAnswer);

  } catch (err) {

    console.error("Answer Route Error:", err);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.end();
  }
});

export default router;