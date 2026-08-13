
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
import util from "node:util";

const app = express();
const server = http.createServer(app);
const upload = multer({ dest: "uploads/" });

const PORT = process.env.PORT || 5000;
const ANSWER_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const PROFILE_MODEL = process.env.PROFILE_MODEL || "gpt-5";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(
  cors({
    origin: ALLOWED_ORIGIN === "*" ? true : ALLOWED_ORIGIN.split(","),
    credentials: false,
  })
);

app.use(express.json({ limit: "10mb" }));

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

let cachedResumeProfile = null;

app.get("/", (req, res) => {
  res.send("AI Interview Assistant Backend Running 🚀");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    deepgram: Boolean(process.env.DEEPGRAM_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    profileModel: PROFILE_MODEL,
    answerModel: ANSWER_MODEL,
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

app.post("/resume-summary", upload.single("resume"), async (req, res) => {
  try {

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ resumeProfile: null });
    }

    if (!req.file) {
      return res.status(400).json({
        resumeProfile: null,
        error: "Resume PDF is required"
      });
    }

    const pdfPath = req.file.path;

    const pdfBuffer = fs.readFileSync(pdfPath);
    fs.unlinkSync(pdfPath);

    const pdfBase64 = pdfBuffer.toString("base64");

    const prompt = `
    You are a strict resume extraction and interview preparation assistant.

    Extract ONLY facts explicitly available in the uploaded resume.

    Never guess.
    Never invent.

    If any information is missing, return an empty string ("") or an empty array ([]).

    ==================================================
    SELF INTRODUCTION
    ==================================================

    Generate ONE interview-ready self introduction.

    It must sound like a real candidate speaking in an interview.

    Use simple natural Indian spoken English.

    Do NOT sound like ChatGPT.

    Do NOT sound like documentation.

    ==================================================
    UNDERSTAND THE RESUME FIRST
    ==================================================

    Before generating the introduction, carefully understand the complete resume.

    Do NOT simply copy the official company designation.

    Instead identify the candidate's actual technical profile based on

    • Skills
    • Technologies
    • Current Project
    • Responsibilities
    • Overall Experience

    Examples

    Java + Spring Boot + Hibernate + REST APIs + Microservices

    → Java Backend Developer

    Java + Spring MVC

    → Java Developer

    Selenium + TestNG + Automation

    → Automation Test Engineer

    React + Angular

    → Frontend Developer

    React + Spring Boot

    → Full Stack Developer

    AWS + Docker + Kubernetes + CI/CD

    → DevOps Engineer

    If the resume clearly belongs to a fresher

    → Entry Level Software Developer

    Never blindly use HR titles like

    Associate System Engineer

    Programmer Analyst

    Graduate Engineer Trainee

    Software Engineer Trainee

    unless no better technical profile can be identified.

    Choose the role that best represents the candidate's actual work.

    ==================================================
    SELF INTRODUCTION FLOW
    ==================================================

    Generate naturally in this order.

    1.

    Start with

    Hi, I am Candidate Name.

    2.

    Mention

    • Technical Profile
    • Current Company
    • Total Experience

    Example

    "I am currently working as a Java Backend Developer at TCS and I have around 3 years of experience."

    3.

    Mention only the strongest 6-10 core technologies.

    Speak naturally.

    Do NOT list every technology.

    4.

    Say

    Currently, I am working on...

    Mention

    • Project Name
    • Domain / Client
    • What the application does
    • Main responsibilities

    Explain naturally.

    5.

    If a genuine previous project exists in the resume,

    mention

    Previously I worked on...

    Otherwise skip completely.

    Never invent previous projects.

    6.

    Mention only resume-supported responsibilities such as

    • REST API Development
    • Spring Boot
    • Microservices
    • Bug Fixing
    • Production Support
    • Docker
    • Kubernetes
    • Security Fixes
    • Unit Testing
    • Agile
    • JIRA

    Only include responsibilities explicitly supported by the resume.

    7.

    Finish naturally.

    Example

    "I am looking for an opportunity where I can work on challenging projects, improve my technical skills, and contribute effectively to the organization."

    End with

    Yeah That's all about my self.

    Thank you.

    ==================================================
    RULES
    ==================================================

    ✔ Use ONLY uploaded resume.

    ✔ Never invent companies.

    ✔ Never invent projects.

    ✔ Never invent experience.

    ✔ Never invent technologies.

    ✔ Never invent achievements.

    ✔ Mention previous project ONLY if explicitly available.

    ✔ Mention only resume-supported responsibilities.

    ✔ Use simple Indian spoken English.

    ✔ Use a mix of short and medium-length sentences.

    ✔ Make the introduction conversational, confident, and easy to speak.

    ✔ Keep the introduction between 180 and 220 words.

    ✔ The introduction should take around 90 to 120 seconds when spoken naturally.

    ✔ Do not simply list skills. Explain naturally where and how they are used.

    ✔ Avoid sounding like you are reading the resume.

    ==================================================
    RESPONSIBILITIES
    ==================================================

    Every responsibility must begin with an action verb such as

    Developed

    Implemented

    Integrated

    Designed

    Configured

    Maintained

    Fixed

    Tested

    Deployed

    ==================================================
    OUTPUT
    ==================================================

    Return exactly ONE valid JSON object.

    {
      "candidateName": "Candidate name",
      "experience": "Total experience exactly as found",
      "currentCompany": "Current company",
      "primaryRole": "Detected technical role",
      "primarySkills": ["Core skills"],
      "secondarySkills": ["Supporting skills"],
      "currentProjectName": "Current project name",
      "currentProjectDomain": "Current project domain or client type",
      "currentProjectSummary": "Brief factual current project overview",
      "currentProjectResponsibilities": ["Current project responsibilities"],
      "previousProjectName": "Previous project name if explicitly available",
      "previousProjectDomain": "Previous project domain if explicitly available",
      "previousProjectSummary": "Brief factual previous project overview",
      "previousProjectResponsibilities": ["Previous project responsibilities"],
      "toolsAndTechnologies": ["Tools and technologies"],
      "achievements": ["Only explicit achievements"],
      "candidateSummary": "Brief factual professional summary",
      "selfIntroduction": "One complete natural interview-ready self introduction following the exact flow above"
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
              file_data: `data:application/pdf;base64,${pdfBase64}`
            },
            {
              type: "input_text",
              text: prompt
            }
          ]
        }
      ],
    }),
    });

    const data = await response.json();

    console.log("========== OPENAI RESPONSE ==========");
    console.log(util.inspect(data, {
      depth: null,
      colors: true,
      maxArrayLength: null,
    }));
    console.log("=====================================");

    if (!response.ok) {
      console.error("Resume Summary OpenAI Error:", data);
      return res.status(response.status).json({ resumeProfile: null });
    }

  let text = data.output_text;

  if (!text && data.output) {
    const message = data.output.find(item => item.type === "message");

    if (message?.content?.length) {
      text = message.content
        .map(c => c.text?.value || c.text || "")
        .join("");
    }
  }

  if (!text) {
    console.error("No text found in OpenAI response");
    return res.status(500).json({
      resumeProfile: null,
      error: "OpenAI returned empty response"
    });
  }

  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  console.log("========== MODEL OUTPUT ==========");
  console.log(text);
  console.log("=================================");

  const resumeProfile = JSON.parse(text);

  cachedResumeProfile = resumeProfile;

  res.json({
    resumeProfile
  });
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
        content: `
    You are a senior interview coach helping a candidate in a live interview.
    Answer exactly like an experienced Indian speaking to the interviewer, Speak naturally.
    The Candidate Profile below was already generated by GPT-5 after deeply analyzing the uploaded PDF resume.
    Treat this Candidate Profile as the ONLY source of truth.

    Candidate Profile:
    ${
      cachedResumeProfile
        ? JSON.stringify(cachedResumeProfile, null, 2)
        : "Candidate profile not available."
    }

    The Candidate Profile contains:
    • Candidate Name
    • Experience
    • Current Company
    • Technical Role
    • Primary Skills
    • Secondary Skills
    • Current Project
    • Project Summary
    • Project Responsibilities
    • Previous Project (if available)
    • Tools and Technologies
    • Achievements
    • Professional Summary
    • Interview-ready Self Introduction

    Never invent:
    • Companies
    • Projects
    • Responsibilities
    • Technologies
    • Achievements
    • Experience
    • Dates
    • Numbers
    • Production incidents

    If the Candidate Profile doesn't show direct experience with a technology, explain the concept correctly without pretending the candidate worked on it.

    Example:
    "I haven't worked directly on Kafka, but I understand how it works and I'll explain it."

    Use previous conversation history to maintain interview continuity.

    For follow-up questions:
    • Continue naturally from the previous answer.
    • Do not restart the topic.
    • Do not repeat information already explained.
    • Answer only the newly asked part.
    • If asked "why", explain only the reason.
    • If asked "how", explain only the implementation or process.
    • If asked for an example, provide one practical real-world example.
    • If asked for a comparison, compare only the requested concepts.
    • Keep the same interview context unless the interviewer changes it.

    If the question is new, answer it independently.

    Always speak like a real Indian software engineer in an interview.

    Use simple Indian spoken English.

    Follow the Markdown format generated by buildPrompt().
    `,},
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
      SELF_INTRO: 300,
      CODING: 450,
      SCENARIO: 400,
      ARCHITECTURE: 900,
      CONCEPT: 300,
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
          model: ANSWER_MODEL,
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
