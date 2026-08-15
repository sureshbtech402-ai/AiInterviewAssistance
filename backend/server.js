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
// Use fast models for sub-second streaming
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

// WebSocket Server
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
    } catch (err) {
      console.error("Deepgram keepAlive error:", err);
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
      } catch (err) {
        console.error("Deepgram buffer send error:", err);
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
    } catch (err) {
      console.error("Deepgram send error:", err);
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
    }
  });

  client.on("close", () => {
    closedByClient = true;
    clearInterval(keepAlive);
    try {
      if (dgConnection) dgConnection.finish();
    } catch (err) {
      console.error("Deepgram finish error:", err);
    }
  });

  client.on("error", (err) => console.error("WebSocket Client Error:", err));
});

// Resume Extraction (High Speed, Accurate Spoken Indian Self-Intro)
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
Extract factual details from the resume into JSON format.

Write "selfIntroduction" in SPOKEN Indian IT English (100-130 words).
It must sound spoken in first person:
"Hi, I'm [Name]. I have around [X] years of experience in Java, Spring Boot, and Microservices, currently working at [Company]. In my current project, I work on developing REST APIs, handling Kafka event streaming, and writing unit tests using JUnit. Before this, I worked on [past work]. That's a brief intro about me. Thank you."

Return ONLY valid JSON matching this schema:
{
  "candidateName": "",
  "experience": "",
  "currentCompany": "",
  "primaryRole": "",
  "primarySkills": [],
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

// Live Answer Generator
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
        content: `You are an experienced Indian IT Software/Automation Engineer SPEAKING live in an interview.
Candidate Profile:
${profileText}

CRITICAL RULES:
1. NEVER speak like a textbook or documentation. Do NOT start with "A HashMap is a data structure..." or "In software engineering...".
2. Start DIRECTLY with conversational spoken English: "Basically...", "In Java, we use...", "In my current project, I...".
3. Length: Strictly 2 to 4 spoken sentences (30-50 words max).
4. For coding/syntax: output the code snippet first, followed by 1 spoken explanation sentence.
5. NO headings, NO markdown asterisks, NO bullet points, NO filler words like "Certainly" or "Sure".

FEW-SHOT SPOKEN EXAMPLES:

Q: "What is HashMap?"
A: "HashMap is basically a key-value collection in Java. We use it when we want to store and retrieve values using unique keys with average O(1) lookup. In my project, we use it for caching session data and test data. It is not thread-safe."

Q: "Why is it not thread safe?"
A: "Because HashMap methods are not synchronized. If multiple threads try to put or remove elements simultaneously, it leads to race conditions and inconsistent data. In multi-threaded scenarios, we prefer ConcurrentHashMap."

Q: "How do you handle windows in Selenium?"
A: "For multiple windows, I use getWindowHandles() to get all the window IDs. Then I iterate through them using driver.switchTo().window() based on the title or URL, and proceed with the validation."

Q: "Explain your project."
A: "In my current project at ${resumeProfile?.currentCompany || 'my company'}, I work on the ${resumeProfile?.currentProjectName || 'backend services'} module. My day-to-day work involves developing REST APIs using Spring Boot, writing unit tests with JUnit, and deploying containerized services on Kubernetes."`
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
        temperature: 0.1, // Low temperature eliminates rambling
        max_completion_tokens: maxTokensByType[questionType] || 160,
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