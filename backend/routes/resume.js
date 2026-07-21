import express from "express";
import crypto from "node:crypto";

import { askOpenAI } from "../services/openaiService.js";
import { buildResumePrompt } from "../prompts/resumePrompt.js";
import { saveProfile } from "../store/resumeStore.js";

const router = express.Router();

router.post("/resume-summary", async (req, res) => {
  try {
    //----------------------------------------
    // Read Resume Text
    //----------------------------------------

    const { resumeText } = req.body;

    if (!resumeText || !resumeText.trim()) {
      return res.status(400).json({
        success: false,
        message: "Resume text is required.",
      });
    }

    //----------------------------------------
    // Generate Session ID
    //----------------------------------------

    const sessionId = crypto.randomUUID();

    //----------------------------------------
    // Build Prompt
    //----------------------------------------

    const prompt = buildResumePrompt(resumeText);

    //----------------------------------------
    // Ask OpenAI
    //----------------------------------------

    const aiResponse = await askOpenAI(
      [
        {
          role: "user",
          content: prompt,
        },
      ],
      {
        responseFormat: "json_object",
        temperature: 0.2,
        maxTokens: 2500,
      }
    );

    //----------------------------------------
    // Parse AI Response
    //----------------------------------------

    const profile = JSON.parse(aiResponse);

    //----------------------------------------
    // Save Profile
    //----------------------------------------

    saveProfile(sessionId, profile);

    //----------------------------------------
    // Return Response
    //----------------------------------------

    return res.status(200).json({
      success: true,
      sessionId,
      resumeProfile: profile,
    });
  } catch (err) {
    console.error("Resume Summary Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
});

export default router;