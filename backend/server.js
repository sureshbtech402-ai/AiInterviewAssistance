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

// ============================================================
// RESUME EXTRACTION - FACTUAL CANDIDATE PROFILE
// ============================================================

app.post(
  "/resume-summary",
  upload.single("resume"),
  async (req, res) => {
    let pdfPath = null;

    try {
      // --------------------------------------------------------
      // 1. BASIC VALIDATION
      // --------------------------------------------------------

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

      // --------------------------------------------------------
      // 2. READ PDF
      // --------------------------------------------------------

      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfBase64 = pdfBuffer.toString("base64");

      // --------------------------------------------------------
      // 3. EXTRACTION INSTRUCTIONS
      // --------------------------------------------------------

      const prompt = `
Extract the candidate's factual information from the uploaded resume.

The uploaded resume is the ONLY source of truth.

Your job is ONLY to extract structured facts from the resume.

Do NOT:
- write a resume
- improve the resume
- rewrite the candidate's experience
- infer missing information
- use general industry knowledge
- assume technologies were used in a project
- assume a project is current when the resume does not clearly say so

FACTUAL EXTRACTION RULES:

1. Extract only information explicitly present in the resume.

2. Never guess or assume:
- years of experience
- current company
- current role
- project responsibilities
- project technologies
- databases
- cloud platforms
- architecture
- integrations
- migrations
- production experience
- achievements
- metrics
- clients
- project purpose

3. If information is not available:
- return "" for strings
- return [] for arrays

4. Preserve the terminology used in the resume where possible.

5. Do not calculate years of experience.
Use the experience value stated in the resume.

6. Do not convert job titles into a different title.
Use the actual designation from the resume.

CURRENT PROJECT:

Only populate currentProjectName when the resume clearly identifies a project as current, present, ongoing, or the candidate's current project.

If the resume contains multiple projects but does NOT clearly identify which one is current:
- currentProjectName = ""
- currentProjectSummary = ""
- projectDomain = ""
- projectResponsibilities = []
- projectTechnologies = []

Do NOT choose a project merely because it is the longest or most detailed project.

SKILLS:

primarySkills:
Important technical skills explicitly listed in the resume.

secondarySkills:
Other supporting tools, technologies, frameworks, platforms, or technical skills explicitly listed in the resume.

Do not unnecessarily duplicate the same skill in both arrays.

PROJECT TECHNOLOGIES:

projectTechnologies must contain ONLY technologies or tools that the resume explicitly connects to the identified project.

Do NOT copy all skills into projectTechnologies.

PROJECT RESPONSIBILITIES:

projectResponsibilities must contain ONLY responsibilities explicitly associated with the project.

Never convert a skill into a responsibility.

PROJECT SUMMARY:

currentProjectSummary:
Give a short factual summary based ONLY on the project information explicitly present in the resume.

projectDomain:
Only the business/domain area explicitly stated or clearly identified in the resume.

previousExperience:
Only include previous work experience explicitly mentioned in the resume.

achievements:
Only include awards or achievements explicitly mentioned in the resume.

IMPORTANT:
FACTUAL ACCURACY IS MORE IMPORTANT THAN COMPLETENESS.

Never invent:
- project responsibilities
- project technologies
- architecture
- production incidents
- achievements

Return ONLY valid JSON matching the provided schema.
`.trim();

      console.log("[RESUME] Starting extraction...");
      const startTime = Date.now();

      // --------------------------------------------------------
      // 4. OPENAI RESPONSES API
      // --------------------------------------------------------

      const response = await fetch(
        "https://api.openai.com/v1/responses",
        {
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
        }
      );

      // --------------------------------------------------------
      // 5. READ RESPONSE
      // --------------------------------------------------------

      const data = await response.json();

      console.log(
        `[RESUME] OpenAI response received in ${Date.now() - startTime}ms`
      );

      // --------------------------------------------------------
      // 6. HANDLE OPENAI ERROR
      // --------------------------------------------------------

      if (!response.ok) {
        console.error(
          "[RESUME] OpenAI Error:",
          response.status,
          data
        );

        return res.status(502).json({
          resumeProfile: null,
          error: "Resume extraction failed",
        });
      }

      // --------------------------------------------------------
      // 7. EXTRACT STRUCTURED OUTPUT
      // --------------------------------------------------------

      let text = data.output_text || "";

      if (!text && Array.isArray(data.output)) {
        for (const item of data.output) {
          if (
            item.type === "message" &&
            Array.isArray(item.content)
          ) {
            for (const content of item.content) {
              if (content.type === "output_text") {
                text += content.text || "";
              }
            }
          }
        }
      }

      if (!text.trim()) {
        console.error("[RESUME] Empty OpenAI output");
        return res.status(502).json({
          resumeProfile: null,
          error: "Resume extraction returned empty result",
        });
      }

      // --------------------------------------------------------
      // 8. PARSE JSON
      // --------------------------------------------------------

      let resumeProfile;

      try {
        resumeProfile = JSON.parse(text.trim());
      } catch (parseError) {
        console.error("[RESUME] JSON Parse Error:", parseError);
        return res.status(502).json({
          resumeProfile: null,
          error: "Invalid resume profile returned",
        });
      }

      // --------------------------------------------------------
      // 9. NORMALIZE PROFILE
      // --------------------------------------------------------

      resumeProfile = {
        candidateName:
          typeof resumeProfile.candidateName === "string"
            ? resumeProfile.candidateName.trim()
            : "",

        experience:
          typeof resumeProfile.experience === "string"
            ? resumeProfile.experience.trim()
            : "",

        currentCompany:
          typeof resumeProfile.currentCompany === "string"
            ? resumeProfile.currentCompany.trim()
            : "",

        primaryRole:
          typeof resumeProfile.primaryRole === "string"
            ? resumeProfile.primaryRole.trim()
            : "",

        primarySkills: Array.isArray(resumeProfile.primarySkills)
          ? resumeProfile.primarySkills
              .filter((item) => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],

        secondarySkills: Array.isArray(resumeProfile.secondarySkills)
          ? resumeProfile.secondarySkills
              .filter((item) => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],

        currentProjectName:
          typeof resumeProfile.currentProjectName === "string"
            ? resumeProfile.currentProjectName.trim()
            : "",

        currentProjectSummary:
          typeof resumeProfile.currentProjectSummary === "string"
            ? resumeProfile.currentProjectSummary.trim()
            : "",

        projectDomain:
          typeof resumeProfile.projectDomain === "string"
            ? resumeProfile.projectDomain.trim()
            : "",

        projectResponsibilities: Array.isArray(
          resumeProfile.projectResponsibilities
        )
          ? resumeProfile.projectResponsibilities
              .filter((item) => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],

        projectTechnologies: Array.isArray(
          resumeProfile.projectTechnologies
        )
          ? resumeProfile.projectTechnologies
              .filter((item) => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],

        previousExperience:
          typeof resumeProfile.previousExperience === "string"
            ? resumeProfile.previousExperience.trim()
            : "",

        achievements: Array.isArray(resumeProfile.achievements)
          ? resumeProfile.achievements
              .filter((item) => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
      };

      // --------------------------------------------------------
      // 10. LOG SUMMARY
      // --------------------------------------------------------

      console.log(
        `[RESUME] Profile extracted: name=${Boolean(
          resumeProfile.candidateName
        )}, skills=${resumeProfile.primarySkills.length}, project=${Boolean(
          resumeProfile.currentProjectName
        )}`
      );

      console.log(
        `[RESUME] Extraction completed in ${Date.now() - startTime}ms`
      );

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
  }
);

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
  if (event.type === "response.output_text.delta") return event.delta || "";
  return "";
}

function buildInterviewProfile(profile = {}) {
  const list = (value = []) =>
    Array.isArray(value) && value.length
      ? value.join(", ")
      : "Not specified in resume";

  const text = (value = "") =>
    String(value || "").trim() || "Not specified in resume";

  return `
Name: ${text(profile.candidateName)}
Experience: ${text(profile.experience)}
Role: ${text(profile.primaryRole)}
Company: ${text(profile.currentCompany)}
Primary Skills: ${list(profile.primarySkills)}
Secondary Skills: ${list(profile.secondarySkills)}
Current Project: ${text(profile.currentProjectName)}
Project Summary: ${text(profile.currentProjectSummary)}
Project Domain: ${text(profile.projectDomain)}
Project Responsibilities:
${list(profile.projectResponsibilities)}
Project Technologies:
${list(profile.projectTechnologies)}
Previous Experience:
${text(profile.previousExperience)}
Achievements:
${list(profile.achievements)}
`.trim();
}

export { buildInterviewProfile };

app.post("/answer", async (req, res) => {
  const {
    question,
    interviewLevel = "",
    company = "",
    interviewType = "",
    history,
    resumeProfile,
  } = req.body || {};

  const cleanQ = getCleanQuestion(question);

  if (!cleanQ.trim()) {
    return res.status(400).send("Question is empty");
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).send("OPENAI_API_KEY missing");
  }

  try {
    const startTime = Date.now();
    const safeHistory = Array.isArray(history) ? history : [];

    // ============================================================
    // 1. CLASSIFY QUESTION & BUILD PROMPT
    // ============================================================

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

    // ============================================================
    // 2. RECENT INTERVIEW CONTEXT & FOLLOW-UP DETECTION
    // ============================================================

    const recentHistory = getRecentConversationHistory(safeHistory, 4);
    const interviewContext = buildInterviewContext(recentHistory);

    const isFollowUp =
      isFollowUpQuestion(cleanQ) &&
      hasEnoughFollowUpContext(recentHistory);

    const previousContext =
      interviewContext.historyText ||
      "No previous interview context available.";

    // ============================================================
    // 3. START RESPONSE STREAM
    // ============================================================

    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (res.flushHeaders) {
      res.flushHeaders();
    }

    // ============================================================
    // 4. MODEL MESSAGES - INDIAN IT SPOKEN PERSONA
    // ============================================================

    const messages = [
      {
        role: "system",
        content: `
You are an experienced Indian IT software professional answering live in a technical interview.

CORE PERSONA & VOICE:
- Speak directly in the first person ("I", "we", "in our project").
- Use natural, fluent Indian IT spoken English (confident, practical, and conversational).
- Never use robotic AI filler phrases like "Certainly!", "Sure thing!", "That's a great question!", "In conclusion", or "As an AI".
- Answer immediately with zero introductory preamble.

GROUND TRUTH RULES:
- The CANDIDATE PROFILE is the single source of truth for personal and project experience.
- NEVER fabricate project facts, responsibilities, tools used in a project, metrics, incidents, or architecture.
- If a skill is listed only in primary/secondary skills (not in project technologies/responsibilities), treat it as technical theoretical knowledge—do NOT claim it was implemented in the current project.
- For concept questions (e.g., "What is HashMap?", "Explain indexing"), explain the technical concept directly and crisply without adding unsolicited personal disclaimers.
- For coding questions: output the code snippet first, followed by a concise spoken explanation of logic and time/space complexity.
- For follow-ups: answer ONLY the specific follow-up point; do not re-explain earlier points.

FORMATTING & HIGHLIGHTING:
- Use light inline markdown **bold** only on essential technical keywords for quick scannability.
- Keep answers appropriately sized for natural spoken delivery (30-60 seconds equivalent).
        `.trim(),
      },
      {
        role: "user",
        content: `
CANDIDATE PROFILE:
${profileText || "No resume profile available."}

INTERVIEW CONTEXT:
${previousContext}

FOLLOW-UP STATUS:
${isFollowUp ? "YES - THIS IS A FOLLOW-UP QUESTION" : "NO - THIS IS A NEW QUESTION"}

PREVIOUS QUESTION:
${interviewContext.previousQuestion || "None"}

PREVIOUS CANDIDATE ANSWER:
${interviewContext.previousAnswer || "None"}

QUESTION TYPE:
${questionType}

QUESTION-SPECIFIC INSTRUCTIONS:
${prompt}

CURRENT INTERVIEWER QUESTION:
${cleanQ}

IMPORTANT:
If FOLLOW-UP STATUS is YES, answer only the specific follow-up point asked. Do not repeat previous answers.
        `.trim(),
      },
    ];

    // ============================================================
    // 5. OUTPUT TOKEN LIMITS (OPTIMIZED FOR FAST STREAMING)
    // ============================================================

    const maxTokensByType = {
      SELF_INTRO: 320,
      CODING: 500,
      PROJECT: 340,
      SCENARIO: 280,
      ARCHITECTURE: 420,
      CONCEPT: 220,
    };

    const maxTokens = maxTokensByType[questionType] || 250;

    console.log(
      `[ANSWER] ${questionType} | followUp=${isFollowUp} | model=${ANSWER_MODEL} | preparing=${Date.now() - startTime}ms`
    );

    // ============================================================
    // 6. OPENAI STREAMING REQUEST
    // ============================================================

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

    // ============================================================
    // 7. OPENAI ERROR HANDLING
    // ============================================================

    if (!openaiResponse.ok || !openaiResponse.body) {
      let errorText = "";
      try {
        errorText = await openaiResponse.text();
      } catch {
        errorText = "";
      }

      console.error(
        `[ANSWER] OpenAI Error ${openaiResponse.status}:`,
        errorText
      );

      if (!res.headersSent) {
        return res
          .status(502)
          .send("Unable to generate answer right now.");
      }

      res.write("Unable to generate answer right now.");
      return res.end();
    }

    // ============================================================
    // 8. STREAM RESPONSE TO CLIENT
    // ============================================================

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
            `[ANSWER] ${questionType} FIRST TOKEN: ${Date.now() - startTime}ms`
          );
        }

        res.write(delta);
        if (res.flush) {
          res.flush();
        }
      } catch {
        // Ignore incomplete SSE chunks
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
      `[ANSWER] ${questionType} COMPLETED: ${Date.now() - startTime}ms`
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