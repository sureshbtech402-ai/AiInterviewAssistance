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

// WebSocket Server for Real-Time STT
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

// Resume Extraction - Factual and Natural Spoken Self-Intro
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
Extract factual details from the resume into valid JSON.

Write "selfIntroduction" in clean, natural spoken Indian IT English (110-140 words).
Structure:
"Hi, I'm [Name]. I have around [X] years of experience as a [Role], and currently I'm working with [Company].
My main skills are [Primary Skills like Core Java, Spring Boot, Microservices, REST APIs, etc.]. I also have hands-on experience with [Secondary Skills like Git, Jenkins, Docker, etc.].
Currently, I'm working on [Project Name] for [Client/Domain]. It is a [Domain] application mainly related to [Project Purpose]. In this project, I'm mainly involved in [Key Responsibilities].
Overall, my experience is mainly in [Core Domain/Role]. That's a brief summary about me. Thank you."

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

CORE GUIDELINES:
1. ALWAYS highlight 3 to 6 key terms, annotations, methods, data structures, and complexities in bold (**term**).
2. For specific/why/how follow-ups: Answer ONLY that specific point directly in 2-3 sentences. DO NOT re-explain the whole concept.
3. For top-level technical questions: Explain what it is with practical clarity, internal mechanism, and project usage in 3-4 sentences.
4. For coding questions: Output clean code first, followed by a 1-2 sentence spoken summary.
5. NO headings, NO bullet points, NO filler intros ("Sure", "Certainly"). Output ONLY the spoken response.

FEW-SHOT EXAMPLES:

Q: "What is HashMap?"
A: "**HashMap** is basically a key-value collection in Java that implements the **Map** interface. We use it when we want to store and retrieve values using unique keys with average **O(1)** lookup. Internally, it uses **hashing and bucket arrays** to store entries. In our project, we use it for in-memory lookups and caching test data, while preferring **ConcurrentHashMap** for thread safety."

Q: "Why is it not thread safe?"
A: "**HashMap** is not thread-safe because its methods like **put()** and **get()** are not **synchronized**. If multiple threads access and modify the map concurrently, it can lead to **race conditions** or corrupted bucket structures during rehashing. For thread-safe operations, we switch to **ConcurrentHashMap**."

Q: "Explain your project."
A: "In my current project, I work on the **${resumeProfile?.currentProjectName || 'ING Digitization'}** application. It is a banking platform where we migrated monolithic services to a **Spring Boot microservices architecture**. My day-to-day work involves developing **RESTful APIs**, handling service integration using **Spring Data JPA**, and writing unit tests with **Mockito**."`
      },
    ];

    safeHistory.slice(-3).forEach((turn) => {
      if (!turn || !turn.content) return;
      messages.push({
        role: turn.role === "assistant" ? "assistant" : "user",
        content: String(turn.content).slice(0, 600),
      });
    });

    messages.push({ role: "user", content: prompt });

    const maxTokensByType = {
      SELF_INTRO: 300,
      CODING: 650,
      SCENARIO: 300,
      ARCHITECTURE: 600,
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
        max_completion_tokens: maxTokensByType[questionType] || 180,
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