
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

const app = express();
const server = http.createServer(app);
const upload = multer({ dest: "uploads/" });

const PORT = process.env.PORT || 5000;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
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
    model: OPENAI_MODEL,
  });
});

const wss = new WebSocketServer({ server });

wss.on("connection", (client) => {
  console.log("React WebSocket Connected");

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error("Missing DEEPGRAM_API_KEY");
    client.send(JSON.stringify({ error: "Missing DEEPGRAM_API_KEY" }));
    client.close();
    return;
  }

  let deepgramReady = false;
  let closedByClient = false;
  const pendingAudio = [];

  const dgConnection = deepgram.listen.live({
    model: "nova-3",
    language: "en-US",
    punctuate: true,
    smart_format: true,
    interim_results: true,
    endpointing: 250,
    vad_events: true,
    utterance_end_ms: 1000,
    encoding: "opus",
    container: "webm",
  });

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
    console.log("Deepgram Connected");
    deepgramReady = true;
    sendToClient({ type: "status", status: "deepgram_connected" });

    while (pendingAudio.length > 0) {
      const chunk = pendingAudio.shift();
      try {
        dgConnection.send(chunk);
      } catch (err) {
        console.error("Deepgram buffered send error:", err);
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
        if (pendingAudio.length > 50) pendingAudio.shift();
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

    console.log(`${isFinal ? "Final" : "Interim"} Transcript:`, transcript);

    sendToClient({
      type: "transcript",
      text: transcript,
      isFinal,
      speechFinal,
    });
  });

  dgConnection.on(LiveTranscriptionEvents.Error, (err) => {
    console.error("Deepgram Error:", err);
    sendToClient({ type: "error", error: "Deepgram transcription error" });
  });

  dgConnection.on(LiveTranscriptionEvents.Close, () => {
    console.log("Deepgram Closed");
    deepgramReady = false;
    clearInterval(keepAlive);

    if (!closedByClient && client.readyState === WebSocket.OPEN) {
      sendToClient({ type: "status", status: "deepgram_closed" });
    }
  });

  client.on("close", () => {
    console.log("React WebSocket Closed");
    closedByClient = true;
    clearInterval(keepAlive);

    try {
      dgConnection.finish();
    } catch (err) {
      console.error("Deepgram finish error:", err);
    }
  });

  client.on("error", (err) => {
    console.error("React WebSocket Error:", err);
  });
});

app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ text: "No audio file received" });
    }

    const audioBuffer = fs.readFileSync(req.file.path);

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: "nova-3",
        language: "en-US",
        punctuate: true,
        smart_format: true,
      }
    );

    fs.unlinkSync(req.file.path);

    if (error) throw error;

    const text =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

    res.json({ text });
  } catch (err) {
    console.error("Transcription Error:", err);
    res.status(500).json({ text: "Transcription Error" });
  }
});

app.post("/resume-summary", async (req, res) => {
  try {
    const { resumeText } = req.body;

    if (!resumeText || !String(resumeText).trim()) {
      return res.status(400).json({ resumeProfile: null });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ resumeProfile: null });
    }

    const prompt = `
You are a strict resume extraction and interview preparation assistant.

Extract ONLY facts explicitly available in the resume. Never guess or invent company names, experience, projects, domains, tools, responsibilities, achievements, metrics, or dates. Keep missing values as an empty string or empty array.

Resume Content:
${resumeText}

Create ONE recommended self-introduction in simple, natural Indian spoken English. It must sound like the candidate is directly answering in a live interview, not like a resume summary.

SELF-INTRODUCTION FLOW — FOLLOW THIS ORDER:
1. Start with: "Hi, I am [Candidate Name]."
2. Mention total experience, primary role, and current company when available.
3. Mention the strongest core technologies from the resume.
4. Say: "Currently, I am working on..." and explain the current project, domain/client type, and main responsibilities.
5. Say: "Previously, I worked on..." and briefly explain the previous project and responsibilities ONLY when a genuine previous project exists in the resume.
6. Mention collaboration, development, testing, deployment, or support activities only when supported by the resume.
7. End with one short and natural sentence about learning and professional growth.

SELF-INTRODUCTION RULES:
- Keep it between 90 and 120 words.
- Use short and easy-to-speak sentences.
- Use "currently" and "previously" only when they sound natural and match the correct project context.
- Do not call a major/current project a previous project.
- Never invent a previous project just to complete the format.
- Do not use difficult corporate words.
- Do not begin sentences with "So", "Basically", "Actually", or "Mainly".

For responsibilities, every point must begin with an action verb such as Developed, Implemented, Integrated, Fixed, Deployed, Tested, Designed, Configured, or Maintained.

Return exactly one valid JSON object using this schema:
{
  "candidateName": "Candidate name",
  "experience": "Total experience exactly as found",
  "currentCompany": "Current company",
  "primaryRole": "Primary role",
  "primarySkills": ["Core skills"],
  "secondarySkills": ["Supporting skills"],
  "currentProjectName": "Current project name",
  "currentProjectDomain": "Current project domain or client type",
  "currentProjectSummary": "Brief factual current project overview",
  "currentProjectResponsibilities": ["Current project responsibility"],
  "previousProjectName": "Previous project name if explicitly available",
  "previousProjectDomain": "Previous project domain if explicitly available",
  "previousProjectSummary": "Brief factual previous project overview",
  "previousProjectResponsibilities": ["Previous project responsibility"],
  "toolsAndTechnologies": ["Tools and technologies"],
  "achievements": ["Only explicit achievements"],
  "candidateSummary": "Brief factual professional summary",
  "selfIntroduction": "One recommended natural interview-ready introduction following the exact flow",
  "projectExplanation": "Natural spoken explanation covering current project and previous project only when available",
  "rolesExplanation": "Natural spoken explanation of core responsibilities"
}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Extract resume facts accurately and return only valid JSON. Never invent missing details.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_completion_tokens: 1500,
      }),
    });

    const data = await response.json();
    console.log("========== OPENAI RESPONSE ==========");
    console.log(JSON.stringify(data, null, 2));
    console.log("=====================================");

    if (!response.ok) {
      console.error("Resume Summary OpenAI Error:", data);
      return res.status(response.status).json({ resumeProfile: null });
    }

    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return res.status(500).json({ resumeProfile: null });
    }

    const resumeProfile = JSON.parse(text);
    res.json({ resumeProfile });
  } catch (err) {
    console.error("Resume Summary Error:", err);
    res.status(500).json({ resumeProfile: null });
  }
});

function getCleanQuestion(question) {
  if (!question) return "";
  if (typeof question === "string") return question;
  if (typeof question === "object") {
    return (
      question.question ||
      question.text ||
      question.transcript ||
      JSON.stringify(question)
    );
  }
  return String(question);
}

function extractDeltaFromOpenAIEvent(event) {
  if (!event || typeof event !== "object") return "";

  if (event.choices && Array.isArray(event.choices) && event.choices[0]) {
    const delta = event.choices[0].delta;
    return delta?.content || "";
  }

  if (event.type === "response.output_text.delta") {
    return event.delta || "";
  }

  if (event.type === "response.message.delta") {
    const content = event.delta?.content || [];
    return content.map((item) => item?.text || item?.delta || "").join("");
  }

  return "";
}

app.post("/answer", async (req, res) => {
  const {
    question,
    resumeText,
    interviewLevel,
    company,
    interviewType,
    history,
  } = req.body || {};

  const cleanQ = getCleanQuestion(question);

  if (!cleanQ || !cleanQ.trim()) {
    return res.status(400).send("Question is empty");
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).send("OPENAI_API_KEY is missing");
  }

  try {
    const safeHistory = Array.isArray(history) ? history : [];
    const questionType = classifyQuestion(cleanQ);

    const prompt = buildPrompt({
      question: cleanQ,
      resumeText,
      history: safeHistory,
      interviewLevel,
      company,
      interviewType,
    });

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const messages = [
      {
        role: "system",
        content: `You are a live interview answer assistant.

Speak as the candidate in simple, natural Indian English.
Keep the answer easy to speak in a real interview.
Follow the active prompt's Markdown format exactly.
Use the uploaded resume as the source of truth.
Never invent companies, projects, tools, responsibilities, incidents, achievements, numbers, or technologies.
When the resume does not prove direct experience, explain the concept correctly without claiming project experience.
Use recent conversation messages only to understand genuine follow-up questions.
For a follow-up, continue from the previous answer and do not repeat the full explanation.`,
      },
    ];

    // Keep only recent turns so follow-up memory works without sending too much text.
    safeHistory.slice(-6).forEach((turn) => {
      if (!turn || !turn.content) return;

      messages.push({
        role: turn.role === "assistant" ? "assistant" : "user",
        content: String(turn.content).slice(0, 1800),
      });
    });

    messages.push({
      role: "user",
      content: prompt,
    });

    const maxTokensByType = {
      SELF_INTRO: 350,
      CODING: 750,
      SCENARIO: 650,
      ARCHITECTURE: 900,
      CONCEPT: 500,
    };

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages,
          stream: true,
          temperature: 0.3,
          max_completion_tokens:
            maxTokensByType[questionType] || maxTokensByType.CONCEPT,
        }),
      }
    );

    if (!openaiResponse.ok || !openaiResponse.body) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI Stream Error:", errorText);
      res.write("Unable to generate answer right now. Please try again.");
      return res.end();
    }

    const processSsePart = (part) => {
      const lines = part
        .split("\n")
        .filter((line) => line.startsWith("data:"));

      for (const line of lines) {
        const data = line.replace(/^data:\s*/, "").trim();

        if (!data || data === "[DONE]") {
          continue;
        }

        try {
          const event = JSON.parse(data);
          const delta = extractDeltaFromOpenAIEvent(event);

          if (delta) {
            res.write(delta);
            res.flush?.();
          }
        } catch (err) {
          console.error("OpenAI stream parse error:", err);
        }
      }
    };

    if (typeof openaiResponse.body.getReader === "function") {
      const reader = openaiResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        parts.forEach(processSsePart);
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        processSsePart(buffer);
      }
    } else if (
      typeof openaiResponse.body[Symbol.asyncIterator] === "function"
    ) {
      const decoder = new TextDecoder();
      let buffer = "";

      for await (const chunk of openaiResponse.body) {
        buffer += decoder.decode(chunk, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        parts.forEach(processSsePart);
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        processSsePart(buffer);
      }
    }

    res.end();
  } catch (err) {
    console.error("Answer Stream Error:", err);

    if (!res.headersSent) {
      res.status(500).send("Server Error while generating answer");
    } else {
      res.write("\n\nServer Error while generating answer.");
      res.end();
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
