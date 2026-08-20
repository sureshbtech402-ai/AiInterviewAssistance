import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { buildPrompt } from "./utils/promptBuilder.js";
import { classifyQuestion } from "./utils/questionClassifier.js";
import process from "node:process";
import {
  isFollowUpQuestion,
  getRecentConversationHistory,
  buildInterviewContext,
  hasEnoughFollowUpContext,
} from "./utils/followupHandler.js";

const app = express();
const server = http.createServer(app);
const upload = multer({ dest: "uploads/" });

const PORT = process.env.PORT || 5000;
const ANSWER_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const PROFILE_MODEL = process.env.PROFILE_MODEL || "gpt-4o";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(
  cors({
    origin: ALLOWED_ORIGIN === "*" ? true : ALLOWED_ORIGIN.split(","),
    credentials: false,
  })
);

app.use(express.json({ limit: "10mb" }));

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

app.get("/", (req, res) => {
  res.send("AI Interview Assistant Backend Running 🚀");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    deepgram: Boolean(process.env.DEEPGRAM_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    answerModel: ANSWER_MODEL,
    profileModel: PROFILE_MODEL,
  });
});

// ============================================================
// WEBSOCKET SERVER FOR REAL-TIME STT (DEEPGRAM)
// ============================================================
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (client) => {
  if (!process.env.DEEPGRAM_API_KEY) {
    client.send(JSON.stringify({ error: "Missing DEEPGRAM_API_KEY" }));
    client.close();
    return;
  }

  let deepgramReady = false;
  let closedByClient = false;
  const pendingAudio = [];

  let dgConnection;
  try {
    dgConnection = deepgram.listen.live({
      model: "nova-2",
      language: "en-US",
      smart_format: true,
      interim_results: true,
      endpointing: 250,
      vad_events: true,
    });
  } catch (err) {
    console.error("Deepgram live init error:", err);
    return;
  }

  const keepAlive = setInterval(() => {
    try {
      if (deepgramReady && typeof dgConnection.keepAlive === "function") {
        dgConnection.keepAlive();
      }
    } catch {
      // keepAlive handler
    }
  }, 5000);

  const sendToClient = (payload) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  };

  dgConnection.on(LiveTranscriptionEvents.Open, () => {
    deepgramReady = true;
    sendToClient({ type: "status", status: "deepgram_connected" });

    while (pendingAudio.length > 0) {
      const chunk = pendingAudio.shift();
      try {
        dgConnection.send(chunk);
      } catch {
        // chunk send handler
      }
    }
  });

  client.on("message", (audioChunk) => {
    if (!audioChunk || audioChunk.length === 0) return;

    try {
      if (deepgramReady && dgConnection.getReadyState() === 1) {
        dgConnection.send(audioChunk);
      } else {
        pendingAudio.push(audioChunk);
        if (pendingAudio.length > 80) pendingAudio.shift();
      }
    } catch {
      // audio handler
    }
  });

  dgConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const transcript = data?.channel?.alternatives?.[0]?.transcript || "";
    if (!transcript.trim()) return;

    const isFinal = Boolean(data?.is_final);
    const speechFinal = Boolean(data?.speech_final);

    sendToClient({
      type: "transcript",
      text: transcript,
      isFinal,
      speechFinal,
    });
  });

  dgConnection.on(LiveTranscriptionEvents.Error, () => {
    sendToClient({ type: "error", error: "Deepgram error" });
  });

  dgConnection.on(LiveTranscriptionEvents.Close, () => {
    deepgramReady = false;
    clearInterval(keepAlive);
    if (!closedByClient && client.readyState === WebSocket.OPEN) {
      sendToClient({ type: "status", status: "deepgram_closed" });
    }
  });

  client.on("close", () => {
    closedByClient = true;
    clearInterval(keepAlive);
    try {
      if (dgConnection) dgConnection.finish();
    } catch {
      // finish handler
    }
  });
});

// ============================================================
// RESUME EXTRACTION - FACTUAL CANDIDATE PROFILE (STRUCTURED OUTPUT)
// ============================================================
app.post("/resume-summary", upload.single("resume"), async (req, res) => {
  let pdfPath = null;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        resumeProfile: null,
        error: "OPENAI_API_KEY missing",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        resumeProfile: null,
        error: "Resume required",
      });
    }

    pdfPath = req.file.path;
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString("base64");

    const prompt = `
Extract the candidate's factual information from the uploaded resume.
The uploaded resume is the ONLY source of truth.

FACTUAL EXTRACTION RULES:
1. Extract ONLY information explicitly present in the resume.
2. Never guess or infer missing data, databases, cloud tools, or client names.
3. If not available, return "" for strings and [] for arrays.
4. Populate currentProjectName only when clearly identified as the candidate's current/recent project.
5. projectTechnologies and projectResponsibilities must contain ONLY items tied directly to that project.

Return ONLY valid JSON matching the schema.
`.trim();

    console.log("[RESUME] Starting profile extraction with", PROFILE_MODEL);
    const startTime = Date.now();

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: PROFILE_MODEL,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_file",
                filename: req.file.originalname,
                file_data: `data:application/pdf;base64,${pdfBase64}`,
              },
              {
                type: "input_text",
                text: prompt,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "candidate_resume_profile",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                candidateName: { type: "string" },
                experience: { type: "string" },
                currentCompany: { type: "string" },
                primaryRole: { type: "string" },
                primarySkills: {
                  type: "array",
                  items: { type: "string" },
                },
                secondarySkills: {
                  type: "array",
                  items: { type: "string" },
                },
                currentProjectName: { type: "string" },
                currentProjectSummary: { type: "string" },
                projectDomain: { type: "string" },
                projectResponsibilities: {
                  type: "array",
                  items: { type: "string" },
                },
                projectTechnologies: {
                  type: "array",
                  items: { type: "string" },
                },
                previousExperience: { type: "string" },
                achievements: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: [
                "candidateName",
                "experience",
                "currentCompany",
                "primaryRole",
                "primarySkills",
                "secondarySkills",
                "currentProjectName",
                "currentProjectSummary",
                "projectDomain",
                "projectResponsibilities",
                "projectTechnologies",
                "previousExperience",
                "achievements",
              ],
            },
          },
        },
      }),
    });

    const data = await response.json();
    console.log(`[RESUME] Extracted in ${Date.now() - startTime}ms`);

    if (!response.ok) {
      console.error("[RESUME] OpenAI Error:", response.status, data);
      return res.status(502).json({
        resumeProfile: null,
        error: "Resume extraction failed",
      });
    }

    let text = data.output_text || "";
    if (!text && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === "message" && Array.isArray(item.content)) {
          for (const content of item.content) {
            if (content.type === "output_text") {
              text += content.text || "";
            }
          }
        }
      }
    }

    if (!text.trim()) {
      return res.status(502).json({
        resumeProfile: null,
        error: "Resume extraction returned empty result",
      });
    }

    const rawProfile = JSON.parse(text.trim());

    const resumeProfile = {
      candidateName: String(rawProfile.candidateName || "").trim(),
      experience: String(rawProfile.experience || "").trim(),
      currentCompany: String(rawProfile.currentCompany || "").trim(),
      primaryRole: String(rawProfile.primaryRole || "").trim(),
      primarySkills: Array.isArray(rawProfile.primarySkills)
        ? rawProfile.primarySkills.map((s) => String(s).trim()).filter(Boolean)
        : [],
      secondarySkills: Array.isArray(rawProfile.secondarySkills)
        ? rawProfile.secondarySkills.map((s) => String(s).trim()).filter(Boolean)
        : [],
      currentProjectName: String(rawProfile.currentProjectName || "").trim(),
      currentProjectSummary: String(rawProfile.currentProjectSummary || "").trim(),
      projectDomain: String(rawProfile.projectDomain || "").trim(),
      projectResponsibilities: Array.isArray(rawProfile.projectResponsibilities)
        ? rawProfile.projectResponsibilities.map((s) => String(s).trim()).filter(Boolean)
        : [],
      projectTechnologies: Array.isArray(rawProfile.projectTechnologies)
        ? rawProfile.projectTechnologies.map((s) => String(s).trim()).filter(Boolean)
        : [],
      previousExperience: String(rawProfile.previousExperience || "").trim(),
      achievements: Array.isArray(rawProfile.achievements)
        ? rawProfile.achievements.map((s) => String(s).trim()).filter(Boolean)
        : [],
    };

    return res.json({ resumeProfile });
  } catch (err) {
    console.error("[RESUME] Processing Error:", err);
    return res.status(500).json({
      resumeProfile: null,
      error: "Resume processing failed",
    });
  } finally {
    if (pdfPath && fs.existsSync(pdfPath)) {
      try {
        fs.unlinkSync(pdfPath);
      } catch (cleanupError) {
        console.error("[RESUME] PDF cleanup failed:", cleanupError);
      }
    }
  }
});

// ============================================================
// COMPACT PROFILE BUILDER (REDUCES INPUT TOKENS & LATENCY)
// ============================================================
function buildInterviewProfile(profile = {}) {
  const parts = [];

  if (profile.candidateName) parts.push(`Name: ${profile.candidateName}`);
  if (profile.experience) parts.push(`Experience: ${profile.experience}`);
  if (profile.primaryRole) parts.push(`Role: ${profile.primaryRole}`);
  if (profile.currentCompany) parts.push(`Company: ${profile.currentCompany}`);

  if (Array.isArray(profile.primarySkills) && profile.primarySkills.length) {
    parts.push(`Primary Skills: ${profile.primarySkills.join(", ")}`);
  }
  if (Array.isArray(profile.secondarySkills) && profile.secondarySkills.length) {
    parts.push(`Secondary Skills: ${profile.secondarySkills.join(", ")}`);
  }
  if (profile.currentProjectName) {
    parts.push(`Project: ${profile.currentProjectName}`);
  }
  if (profile.projectDomain) {
    parts.push(`Domain: ${profile.projectDomain}`);
  }
  if (profile.currentProjectSummary) {
    parts.push(`Project Summary: ${profile.currentProjectSummary}`);
  }
  if (Array.isArray(profile.projectTechnologies) && profile.projectTechnologies.length) {
    parts.push(`Project Technologies: ${profile.projectTechnologies.join(", ")}`);
  }
  if (Array.isArray(profile.projectResponsibilities) && profile.projectResponsibilities.length) {
    parts.push(`Responsibilities: ${profile.projectResponsibilities.join("; ")}`);
  }
  if (Array.isArray(profile.achievements) && profile.achievements.length) {
    parts.push(`Achievements: ${profile.achievements.join("; ")}`);
  }

  return parts.join("\n") || "No explicit profile data available.";
}

export { buildInterviewProfile };

function getCleanQuestion(question) {
  if (!question) return "";
  if (typeof question === "string") return question;
  return (
    question.question ||
    question.text ||
    question.transcript ||
    JSON.stringify(question)
  );
}

function extractDeltaFromOpenAIEvent(event) {
  if (!event || typeof event !== "object") return "";
  if (event.choices?.[0]?.delta?.content) return event.choices[0].delta.content;
  return "";
}

// ============================================================
// ULTRA-FAST STREAMING LIVE INTERVIEW ANSWER (/answer)
// ============================================================
app.post("/answer", async (req, res) => {
  const {
    question,
    interviewLevel = "",
    company = "",
    interviewType = "",
    history,
    resumeProfile,
  } = req.body || {};

  const cleanQ = getCleanQuestion(question).trim();

  if (!cleanQ) {
    return res.status(400).send("Question is empty");
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).send("OPENAI_API_KEY missing");
  }

  try {
    const startTime = Date.now();
    const safeHistory = Array.isArray(history) ? history : [];

    const questionType = classifyQuestion(cleanQ);

    const prompt = buildPrompt({
      question: cleanQ,
      interviewLevel,
      company,
      interviewType,
    });

    if (!prompt) {
      return res.status(400).send("Unable to build interview prompt");
    }

    const profileText = buildInterviewProfile(resumeProfile || {});
    const recentHistory = getRecentConversationHistory(safeHistory, 3);
    const interviewContext = buildInterviewContext(recentHistory);

    const isFollowUp =
      isFollowUpQuestion(cleanQ) &&
      hasEnoughFollowUpContext(recentHistory);

    const previousContext =
      interviewContext.historyText || "No previous interview context.";

    // Immediate header dispatch
    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (res.flushHeaders) {
      res.flushHeaders();
    }

    const messages = [
      {
        role: "system",
        content: `You are an experienced Indian IT software developer speaking live in an interview.
- Speak directly in the first person ("I", "we", "in our project") using simple, spoken Indian English.
- Start directly with the answer on the very first word. No intro filler, no "Certainly", no "In conclusion".
- The Candidate Profile is the ONLY truth for project experience. Never invent unmentioned tools, metrics, or client names.
- If asked "from scratch" or "step by step", explain the chronological developer steps (Setup -> Config -> Entities -> Service -> Controller -> Testing).
- Use inline **bold** on 2-4 key technical terms only.`.trim(),
      },
      {
        role: "user",
        content: `PROFILE:
${profileText}

CONTEXT:
${previousContext}

FOLLOW-UP: ${isFollowUp ? "YES (Answer only the new specific point)" : "NO"}

QUESTION TYPE: ${questionType}

INSTRUCTIONS:
${prompt}

QUESTION:
"${cleanQ}"`.trim(),
      },
    ];

    const maxTokensByType = {
      SELF_INTRO: 300,
      CODING: 480,
      PROJECT: 320,
      SCENARIO: 260,
      ARCHITECTURE: 380,
      CONCEPT: 200,
    };

    const maxTokens = maxTokensByType[questionType] || 250;

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ANSWER_MODEL,
          messages,
          stream: true,
          temperature: 0.1,
          max_completion_tokens: maxTokens,
        }),
      }
    );

    if (!openaiResponse.ok || !openaiResponse.body) {
      console.error(`[ANSWER] OpenAI Error ${openaiResponse.status}`);
      if (!res.headersSent) {
        return res.status(502).send("Unable to generate answer right now.");
      }
      res.write("Unable to generate answer right now.");
      return res.end();
    }

    const reader = openaiResponse.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";
    let firstToken = true;

    const processLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) return;

      const dataStr = trimmed.replace(/^data:\s*/, "");
      if (!dataStr || dataStr === "[DONE]") return;

      try {
        const event = JSON.parse(dataStr);
        const delta = extractDeltaFromOpenAIEvent(event);
        if (!delta) return;

        if (firstToken) {
          firstToken = false;
          console.log(
            `⚡ [ANSWER] ${questionType} FIRST TOKEN: ${Date.now() - startTime}ms`
          );
        }

        res.write(delta);
        if (res.flush) {
          res.flush();
        }
      } catch {
        // Incomplete chunk handler
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        processLine(line);
      }
    }

    if (buffer.trim()) {
      processLine(buffer);
    }

    console.log(
      `✅ [ANSWER] ${questionType} DONE: ${Date.now() - startTime}ms`
    );

    res.end();
  } catch (err) {
    console.error("[ANSWER] Stream Error:", err);
    if (!res.headersSent) {
      return res.status(500).send("Server Error");
    }
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});