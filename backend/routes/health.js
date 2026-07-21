import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.send("🚀 AI Interview Assistant Backend Running");
});

router.get("/health", (req, res) => {
  res.json({
    status: "UP",
    timestamp: new Date().toISOString(),
    openai: Boolean(process.env.OPENAI_API_KEY),
    deepgram: Boolean(process.env.DEEPGRAM_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  });
});

export default router;