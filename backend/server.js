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

// Boost common IT / interview terms so Deepgram transcribes them accurately
const TECH_KEYWORDS = [
  "Java:2",
  "Spring Boot:2",
  "Microservices:2",
  "HashMap:2",
  "ConcurrentHashMap:2",
  "ArrayList:2",
  "LinkedList:2",
  "Kafka:2",
  "Kubernetes:2",
  "Docker:2",
  "Jenkins:2",
  "REST API:2",
  "SQL:2",
  "PL/SQL:2",
  "PostgreSQL:2",
  "MongoDB:2",
  "Redis:2",
  "Selenium:2",
  "Playwright:2",
  "TestNG:2",
  "JUnit:2",
  "Mockito:2",
  "Terraform:2",
  "AWS:2",
  "Azure:2",
  "React:2",
  "Angular:2",
  "Node.js:2",
  "Python:2",
  "JWT:2",
  "OAuth:2",
  "CI/CD:2",
  "Git:2",
  "Jira:2",
];

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
      language: "en-IN",
      smart_format: true,
      interim_results: true,
      endpointing: 400,
      vad_events: true,
      keywords: TECH_KEYWORDS,
    });
  } catch (err) {
    console.error("Deepgram live init error:", err);
    client.close(1011, "Deepgram init failed");
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

  dgConnection.on(LiveTranscriptionEvents.Error, (err) => {
    console.error("Deepgram Error:", err);
    sendToClient({ type: "error", error: "Deepgram error" });
  });

  dgConnection.on(LiveTranscriptionEvents.Close, () => {
    deepgramReady = false;
    clearInterval(keepAlive);
    if (!closedByClient && client.readyState === WebSocket.OPEN) {
      sendToClient({ type: "status", status: "deepgram_closed" });
      // Close client socket so App.jsx auto-reconnects seamlessly
      client.close(1011, "Deepgram session closed");
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
    screenshot = null,
    interviewLevel = "",
    company = "",
    interviewType = "",
    history,
    resumeProfile,
  } = req.body || {};

  const cleanQ = getCleanQuestion(question).trim();

  if (!cleanQ && !screenshot) {
    return res.status(400).send("Question is empty");
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).send("OPENAI_API_KEY missing");
  }

  try {
    const startTime = Date.now();
    const safeHistory = Array.isArray(history) ? history : [];

    const candidateRole = resumeProfile?.primaryRole?.trim() || "IT professional";

    const effectiveQuestion =
      cleanQ ||
      "Read the question shown in the attached screenshot and answer it directly.";

    const questionType =
      screenshot && !cleanQ
        ? "SCREENSHOT"
        : classifyQuestion(effectiveQuestion);

    const prompt =
      screenshot && !cleanQ
        ? `Read the attached screenshot carefully and identify the exact question shown on screen.
- If it is a CODING or SQL question: output the clean, optimal code/query first in a Markdown code block, followed by a short, simple spoken walkthrough (approach, steps, Time/Space complexity).
- If it is an MCQ (multiple choice): state the exact correct option first, then give a 2-line simple explanation why.
- If it is a THEORY, SCENARIO, or BEHAVIORAL question: give a direct, natural spoken answer in simple daily Indian IT English (1 to 2 short paragraphs).
- Start directly with the answer on word #1.`
        : buildPrompt({
            question: effectiveQuestion,
            interviewLevel,
            company,
            interviewType,
            candidateRole,
          });

    if (!prompt) {
      return res.status(400).send("Unable to build interview prompt");
    }

    const profileText = buildInterviewProfile(resumeProfile || {});
    const recentHistory = getRecentConversationHistory(safeHistory, 3);
    const interviewContext = buildInterviewContext(recentHistory);

    const isFollowUp =
      isFollowUpQuestion(effectiveQuestion) &&
      hasEnoughFollowUpContext(recentHistory);

    const previousContext =
      interviewContext.historyText || "No previous interview context.";

    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (res.flushHeaders) {
      res.flushHeaders();
    }

    const userPromptText = `PROFILE:
${profileText}

ROLE: ${candidateRole}

CONTEXT:
${previousContext}

FOLLOW-UP: ${isFollowUp ? "YES (Answer only the new specific point directly with senior-level clarity)" : "NO"}

QUESTION TYPE: ${questionType}

INSTRUCTIONS:
${prompt}

LIVE TRANSCRIPT QUESTION (May contain an older question at the top and a newer question at the bottom—ALWAYS prioritize the LATEST question at the bottom; if two distinct questions are asked, answer both cleanly):
"${effectiveQuestion}"
${
  screenshot
    ? "\nATTACHED SCREENSHOT: Inspect the attached screenshot carefully (coding problem, MCQ, theory question, error, or architecture diagram) and answer directly."
    : ""
}`.trim();

    const userContent = screenshot
      ? [
          { type: "text", text: userPromptText },
          {
            type: "image_url",
            image_url: {
              url: screenshot,
              detail: "high",
            },
          },
        ]
      : userPromptText;

    const messages = [
      {
        role: "system",
        content: `You are a Senior Indian ${candidateRole} speaking live in a 1-on-1 technical interview.
- TONE: Speak naturally in simple, everyday Indian IT English ("So basically,", "What happens is,", "In our project,", "So we just go with..."). Sound like a confident senior engineer on a call, NOT a textbook.
- DEPTH: Give complete, senior-level technical answers across any domain (Dev, QA, DevOps, Cloud, Data). Cover how it works internally, real-world production trade-offs, and edge cases without cutting off.
- LIVE TRANSCRIPT RULE: The question comes from live speech-to-text. Silently correct obvious STT typos from context (e.g. "has map" -> HashMap, "spring board" -> Spring Boot, "cube net" -> Kubernetes). If the transcript has multiple questions, ALWAYS prioritize the LATEST question at the bottom (and briefly cover the earlier one if both are unanswered).
- CODING EXPLANATION RULE: For coding/query questions, output the clean optimal code first. Right below it, give a proper senior walkthrough in simple daily English: (1) why you chose this approach/data structure, (2) step-by-step logic and edge cases handled, and (3) exact Time and Space complexity with the reason.
- FORMAT: Start directly on word #1 (no "Certainly", no "In conclusion"). Keep sentences short and easy to speak aloud, with inline **bold** on 3-5 key technical terms.
- GROUND TRUTH: The Candidate Profile is the ONLY truth for personal/project experience. Never invent unmentioned tools, client names, or metrics.`.trim(),
      },
      {
        role: "user",
        content: userContent,
      },
    ];

    const maxTokensByType = {
      SELF_INTRO: 450,
      CODING: 900,
      PROJECT: 450,
      SCENARIO: 450,
      ARCHITECTURE: 550,
      CONCEPT: 420,
      SCREENSHOT: 900,
    };

    const maxTokens = screenshot
      ? 900
      : maxTokensByType[questionType] || 420;

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
        // Stream parse handler
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