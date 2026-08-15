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
  });
});

// WebSocket Server for Audio Transcription
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
      // keepAlive error handling
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
        // chunk send handling
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
      // audio error handling
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
      // finish error handling
    }
  });
});

// Resume Profile Extraction with gpt-4o
app.post("/resume-summary", upload.single("resume"), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ resumeProfile: null, error: "OPENAI_API_KEY missing" });
    }
    if (!req.file) {
      return res.status(400).json({ resumeProfile: null, error: "Resume required" });
    }

    const pdfPath = req.file.path;
    const pdfBuffer = fs.readFileSync(pdfPath);
    fs.unlinkSync(pdfPath);

    const pdfBase64 = pdfBuffer.toString("base64");

    const prompt = `
Extract factual information from the uploaded resume into valid JSON.

Create a natural, comprehensive first-person self-introduction (130-160 words) tailored to the candidate's actual domain (Backend, Frontend, Full Stack, QA, DevOps, Data, etc.).

Structure the "selfIntroduction" naturally:
"Hi, I'm [Name]. I have around [X] years of experience in the IT industry, currently working at [Company] as a [Role]. My core expertise includes [Primary Skills & Tools]. In my current project, I work on [Key Project Details & Responsibilities]. In my previous role, I worked on [Previous Project/Tech]. That's a brief summary of my background. Thank you."

Return ONLY valid JSON matching this schema:
{
  "candidateName": "",
  "experience": "",
  "currentCompany": "",
  "primaryRole": "",
  "primarySkills": [],
  "secondarySkills": [],
  "currentProjectName": "",
  "currentProjectSummary": "",
  "selfIntroduction": ""
}`;

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
              { type: "input_text", text: prompt },
            ],
          },
        ],
        text: { format: { type: "json_object" } },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: "Resume extraction failed" });
    }

    let text = data.output_text || "";
    if (!text && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === "message" && Array.isArray(item.content)) {
          for (const content of item.content) {
            if (content.type === "output_text") text += content.text || "";
          }
        }
      }
    }

    const resumeProfile = JSON.parse(text.trim());
    return res.json({ resumeProfile });
  } catch (err) {
    console.error("Resume Summary Error:", err);
    return res.status(500).json({ resumeProfile: null, error: "Resume processing failed" });
  }
});

function getCleanQuestion(question) {
  if (!question) return "";
  if (typeof question === "string") return question;
  return question.question || question.text || question.transcript || JSON.stringify(question);
}

function extractDeltaFromOpenAIEvent(event) {
  if (!event || typeof event !== "object") return "";
  if (event.choices?.[0]?.delta?.content) return event.choices[0].delta.content;
  if (event.type === "response.output_text.delta") return event.delta || "";
  return "";
}

// Live Spoken Answer Endpoint
app.post("/answer", async (req, res) => {
  const {
    question,
    interviewLevel,
    company,
    interviewType,
    history,
    resumeProfile,
  } = req.body || {};

  const cleanQ = getCleanQuestion(question);
  if (!cleanQ.trim() || !process.env.OPENAI_API_KEY) {
    return res.status(400).send("Invalid request");
  }

  try {
    const safeHistory = Array.isArray(history) ? history : [];
    const questionType = classifyQuestion(cleanQ);

    const prompt = buildPrompt({
      question: cleanQ,
      history: safeHistory,
      interviewLevel,
      company,
      interviewType,
    });

    const profileText = resumeProfile
      ? JSON.stringify(resumeProfile, null, 2)
      : "No profile available.";

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

const messages = [
      {
        role: "system",
        content: `You are an articulate Indian IT professional speaking live in a technical interview.
      Candidate Profile:
      ${profileText}

      SPOKEN ANSWER & HIGHLIGHTING GUIDELINES:
      1. Wrap critical technical terms, data structures, algorithms, time complexity, and method names in bold (**keyword**) so the candidate can spot key points in a 1-second scan.
        Example: "**HashMap** is a key-value data structure in Java that implements the **Map** interface with an average lookup of **O(1)**. Internally, it uses **hashing and bucket arrays**..."
      2. Structure:
        - First: Clear technical definition and purpose.
        - Second: Internal working mechanism or core property.
        - Third: Practical real-time usage in the project.
      3. Length: Strictly 4 to 6 spoken sentences (60 to 90 words).
      4. For coding questions: Output the code block first, then 1-2 spoken sentences with bold keywords.
      5. NO headings, NO bullet points, NO filler intros ("Sure", "Certainly").`
      },
    ];

    safeHistory.slice(-4).forEach((turn) => {
      if (!turn || !turn.content) return;
      messages.push({
        role: turn.role === "assistant" ? "assistant" : "user",
        content: String(turn.content).slice(0, 800),
      });
    });

    messages.push({ role: "user", content: prompt });

    const maxTokensByType = {
      SELF_INTRO: 300,
      CODING: 650,
      SCENARIO: 300,
      ARCHITECTURE: 650,
      CONCEPT: 300,
    };

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANSWER_MODEL,
        messages,
        stream: true,
        temperature: 0.15,
        max_completion_tokens: maxTokensByType[questionType] || 220,
      }),
    });

    if (!openaiResponse.ok || !openaiResponse.body) {
      res.write("Unable to generate answer right now.");
      return res.end();
    }

    const processSsePart = (part) => {
      const lines = part.split("\n").filter((line) => line.startsWith("data:"));
      for (const line of lines) {
        const data = line.replace(/^data:\s*/, "").trim();
        if (!data || data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);
          const delta = extractDeltaFromOpenAIEvent(event);
          if (delta) {
            res.write(delta);
            res.flush?.();
          }
        } catch {
          // ignore parse error
        }
      }
    };

    const reader = openaiResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      parts.forEach(processSsePart);
    }

    buffer += decoder.decode();
    if (buffer.trim()) processSsePart(buffer);

    res.end();
  } catch (err) {
    console.error("Answer Stream Error:", err);
    if (!res.headersSent) {
      res.status(500).send("Server Error");
    } else {
      res.end();
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});