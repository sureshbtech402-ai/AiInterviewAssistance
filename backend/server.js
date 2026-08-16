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

    const prompt = `Extract the candidate's information from the uploaded resume and return ONLY valid JSON.

      IMPORTANT:
      The uploaded resume is the only source of truth for the candidate's experience.

      FACTUAL EXTRACTION RULES:
      - Extract only information that is explicitly present in the resume.
      - Never guess, assume, or add information based on common industry practices.
      - Do not add technologies just because they are common for the candidate's role.
      - Do not invent project names, clients, responsibilities, tools, achievements, metrics, domains, or years of experience.
      - If information is not available in the resume, return an empty string or empty array.
      - Preserve the candidate's actual terminology where possible.
      - If the resume contains multiple projects, identify the current/relevant project based on the resume. Do not invent which project is current if it is unclear.

      PROFILE FIELDS:
      candidateName:
      The candidate's full name.

      experience:
      The experience stated in the resume. Do not calculate or change it.

      currentCompany:
      The company the candidate currently works for, if stated.

      primaryRole:
      The candidate's actual role/designation.

      primarySkills:
      The main technical skills explicitly present in the resume.

      secondarySkills:
      Other relevant tools, technologies, frameworks, platforms, or supporting skills explicitly present in the resume.

      currentProjectName:
      The current or most relevant project explicitly stated in the resume.

      currentProjectSummary:
      A short factual summary of what the project does. Use only information supported by the resume.

      projectDomain:
      The business/domain area explicitly stated in the resume.

      projectResponsibilities:
      A list of the candidate's actual responsibilities explicitly stated in the resume.

      projectTechnologies:
      Technologies and tools explicitly associated with the project.

      previousExperience:
      A short factual summary of previous relevant experience if present. Otherwise return an empty string.

      achievements:
      Achievements or awards explicitly mentioned in the resume.

      SELF INTRODUCTION:
      Generate a natural first-person self-introduction using ONLY the extracted resume facts.

      The introduction is for a real candidate speaking during a live Indian technical interview.

      It should normally take around 45-60 seconds when spoken. Do not target an exact word count.

      The natural flow should be:
      - Name and experience.
      - Current role and company.
      - Main technical skills.
      - Current project and what it does.
      - What the candidate personally works on.
      - One relevant responsibility or previous experience if useful.
      - A short natural closing.

      SPEAKING STYLE:
      - Use simple, natural Indian spoken English.
      - Sound like a real candidate talking to an interviewer.
      - Keep sentences easy to speak.
      - Do not sound like a resume being read aloud.
      - Do not use overly formal corporate language.
      - Do not explain every technology.
      - Do not repeat the same information.
      - Natural phrases such as "Currently I'm working on...", "My main responsibility is...", and "Basically..." may be used when they fit naturally.
      - Do not force these phrases.
      - Do not use "yeah that's all about my self".
      - End naturally, for example: "That's a brief overview of my experience."

      SELF INTRODUCTION FACTUAL RULE:
      - Every statement in selfIntroduction must be supported by the resume.
      - Never mention a technology, project, client, responsibility, achievement, or experience that is not supported by the resume.
      - Never turn a general skill listed on the resume into a claim that the candidate used it in the current project unless the resume supports that connection.

      Return ONLY valid JSON using this schema:

      {
        "candidateName": "",
        "experience": "",
        "currentCompany": "",
        "primaryRole": "",
        "primarySkills": [],
        "secondarySkills": [],
        "currentProjectName": "",
        "currentProjectSummary": "",
        "projectDomain": "",
        "projectResponsibilities": [],
        "projectTechnologies": [],
        "previousExperience": "",
        "achievements": [],
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

function buildInterviewProfile(profile = {}) {
  return `
Name: ${profile.candidateName || ""}
Experience: ${profile.experience || ""}
Role: ${profile.primaryRole || ""}
Company: ${profile.currentCompany || ""}
Primary Skills: ${(profile.primarySkills || []).join(", ")}
Secondary Skills: ${(profile.secondarySkills || []).join(", ")}
Project: ${profile.currentProjectName || ""}
Project Summary: ${profile.currentProjectSummary || ""}
Project Domain: ${profile.projectDomain || ""}
Project Responsibilities: ${(profile.projectResponsibilities || []).join("; ")}
Project Technologies: ${(profile.projectTechnologies || []).join(", ")}
Previous Experience: ${profile.previousExperience || ""}
Achievements: ${(profile.achievements || []).join(", ")}
`.trim();
}

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
    const startTime = Date.now();

    const safeHistory = Array.isArray(history) ? history : [];

    const questionType = classifyQuestion(cleanQ);

    const prompt = buildPrompt({
      question: cleanQ,
      interviewLevel,
      company,
      interviewType,
    });

    const profileText = buildInterviewProfile(resumeProfile);

    // Start streaming response immediately
    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (res.flushHeaders) {
      res.flushHeaders();
    }

    const previousContext = safeHistory
      .slice(-2)
      .filter((turn) => turn && turn.content)
      .map(
        (turn) =>
          `${turn.role === "assistant" ? "Candidate" : "Interviewer"}: ${String(
            turn.content
          ).slice(0, 500)}`
      )
      .join("\n");

    const messages = [
      {
        role: "system",
        content: `
You are helping a candidate answer questions during a live IT technical interview.

Speak naturally in simple Indian spoken English, like a real Indian software professional speaking to an interviewer.

  IMPORTANT RULES:
  - Answer only what the interviewer asks.
  - The Candidate Profile is the source of truth for the candidate's actual experience.
  - Never invent projects, technologies, tools, responsibilities, clients, achievements, metrics, or implementation details.
  - General technical knowledge is allowed.
  - If a technology is not present in the profile and the interviewer asks about hands-on experience, clearly say that the candidate has not worked hands-on with it, then explain the concept.
  - Do not claim "In my project we use..." unless the Candidate Profile supports it.
  - For follow-up questions, answer only the new point and do not repeat the previous explanation.
  - Keep simple questions short.
  - Give enough detail for project, scenario, architecture, and other detailed questions.
  - For coding questions, provide the requested code first and then a short explanation.
  - Do not use unnecessary filler.
  - Return only the candidate's answer.
        `.trim(),
      },
      {
        role: "user",
        content: `
Candidate Profile:
${profileText}

Previous Interview Context:
${previousContext || "No previous context available."}

Interview Instructions:
${prompt}

Interviewer Question:
${cleanQ}
        `.trim(),
      },
    ];

    const maxTokensByType = {
      SELF_INTRO: 300,
      CODING: 650,
      SCENARIO: 300,
      ARCHITECTURE: 600,
      CONCEPT: 300,
    };

    console.log(
      `[ANSWER] ${questionType} - sending to OpenAI after ${
        Date.now() - startTime
      }ms`
    );

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
          max_completion_tokens:
            maxTokensByType[questionType] || 180,
        }),
      }
    );

    if (!openaiResponse.ok || !openaiResponse.body) {
      let errorText = "";

      try {
        errorText = await openaiResponse.text();
      } catch {
        errorText = "";
      }

      console.error(
        "[ANSWER] OpenAI Error:",
        openaiResponse.status,
        errorText
      );

      res.write("Unable to generate answer right now.");
      return res.end();
    }

    const reader = openaiResponse.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";
    let firstToken = true;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed.startsWith("data:")) {
          continue;
        }

        const dataStr = trimmed.replace(/^data:\s*/, "");

        if (dataStr === "[DONE]") {
          continue;
        }

        try {
          const event = JSON.parse(dataStr);
          const delta = extractDeltaFromOpenAIEvent(event);

          if (delta) {
            if (firstToken) {
              firstToken = false;

              console.log(
                `[ANSWER] FIRST TOKEN: ${
                  Date.now() - startTime
                }ms`
              );
            }

            res.write(delta);

            if (res.flush) {
              res.flush();
            }
          }
        } catch {
          // Ignore incomplete SSE chunks
        }
      }
    }

    console.log(
      `[ANSWER] COMPLETED: ${Date.now() - startTime}ms`
    );

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