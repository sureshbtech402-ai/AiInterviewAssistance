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

      const pdfBase64 =
        pdfBuffer.toString("base64");

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

Example:

Resume skills:
Java, Spring Boot, Kafka, Docker, Kubernetes

Project description:
"Developed REST endpoints using Spring Boot and created Docker images."

Then:

projectTechnologies:
[
  "Spring Boot",
  "Docker"
]

Do NOT add:
Kafka
Kubernetes

unless the resume explicitly connects them to that project.

PROJECT RESPONSIBILITIES:

projectResponsibilities must contain ONLY responsibilities explicitly associated with the project.

Never convert a skill into a responsibility.

For example, if the resume lists:
"Kafka"

but does not say the candidate used or implemented Kafka in the project, do NOT create:

"Integrated Kafka"

PROJECT SUMMARY:

currentProjectSummary:
Give a short factual summary based ONLY on the project information explicitly present in the resume.

Do not add business functionality that is not stated.

projectDomain:
Only the business/domain area explicitly stated or clearly identified in the resume.

previousExperience:
Only include previous work experience explicitly mentioned in the resume.

achievements:
Only include awards or achievements explicitly mentioned in the resume.

IMPORTANT:

This profile will later be used by another model to answer live interview questions.

Therefore:

FACTUAL ACCURACY IS MORE IMPORTANT THAN COMPLETENESS.

Never:
- turn a skill into project experience
- turn a technology into a responsibility
- turn a general role expectation into actual experience
- invent architecture
- invent databases
- invent cloud platforms
- invent production incidents
- invent clients
- invent metrics
- invent achievements
- invent project responsibilities

Return ONLY valid JSON matching the provided schema.
`.trim();

      console.log(
        "[RESUME] Starting extraction..."
      );

      const startTime = Date.now();

      // --------------------------------------------------------
      // 4. OPENAI RESPONSES API
      // --------------------------------------------------------

      const response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            model: PROFILE_MODEL,

            input: [
              {
                role: "user",

                content: [
                  {
                    type: "input_file",
                    filename:
                      req.file.originalname,
                    file_data:
                      `data:application/pdf;base64,${pdfBase64}`,
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

                name:
                  "candidate_resume_profile",

                strict: true,

                schema: {
                  type: "object",

                  additionalProperties: false,

                  properties: {
                    candidateName: {
                      type: "string",
                    },

                    experience: {
                      type: "string",
                    },

                    currentCompany: {
                      type: "string",
                    },

                    primaryRole: {
                      type: "string",
                    },

                    primarySkills: {
                      type: "array",
                      items: {
                        type: "string",
                      },
                    },

                    secondarySkills: {
                      type: "array",
                      items: {
                        type: "string",
                      },
                    },

                    currentProjectName: {
                      type: "string",
                    },

                    currentProjectSummary: {
                      type: "string",
                    },

                    projectDomain: {
                      type: "string",
                    },

                    projectResponsibilities: {
                      type: "array",
                      items: {
                        type: "string",
                      },
                    },

                    projectTechnologies: {
                      type: "array",
                      items: {
                        type: "string",
                      },
                    },

                    previousExperience: {
                      type: "string",
                    },

                    achievements: {
                      type: "array",
                      items: {
                        type: "string",
                      },
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

      const data =
        await response.json();

      console.log(
        `[RESUME] OpenAI response received in ${
          Date.now() - startTime
        }ms`
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
          error:
            "Resume extraction failed",
        });
      }

      // --------------------------------------------------------
      // 7. EXTRACT STRUCTURED OUTPUT
      // --------------------------------------------------------

      let text =
        data.output_text || "";

      if (
        !text &&
        Array.isArray(data.output)
      ) {
        for (
          const item of data.output
        ) {
          if (
            item.type === "message" &&
            Array.isArray(
              item.content
            )
          ) {
            for (
              const content of item.content
            ) {
              if (
                content.type ===
                "output_text"
              ) {
                text +=
                  content.text || "";
              }
            }
          }
        }
      }

      if (!text.trim()) {
        console.error(
          "[RESUME] Empty OpenAI output"
        );

        return res.status(502).json({
          resumeProfile: null,
          error:
            "Resume extraction returned empty result",
        });
      }

      // --------------------------------------------------------
      // 8. PARSE JSON
      // --------------------------------------------------------

      let resumeProfile;

      try {
        resumeProfile =
          JSON.parse(
            text.trim()
          );
      } catch (parseError) {
        console.error(
          "[RESUME] JSON Parse Error:",
          parseError
        );

        return res.status(502).json({
          resumeProfile: null,
          error:
            "Invalid resume profile returned",
        });
      }

      // --------------------------------------------------------
      // 9. NORMALIZE PROFILE
      //
      // Prevent unexpected null values from reaching
      // buildInterviewProfile().
      // --------------------------------------------------------

      resumeProfile = {
        candidateName:
          typeof resumeProfile.candidateName ===
          "string"
            ? resumeProfile.candidateName.trim()
            : "",

        experience:
          typeof resumeProfile.experience ===
          "string"
            ? resumeProfile.experience.trim()
            : "",

        currentCompany:
          typeof resumeProfile.currentCompany ===
          "string"
            ? resumeProfile.currentCompany.trim()
            : "",

        primaryRole:
          typeof resumeProfile.primaryRole ===
          "string"
            ? resumeProfile.primaryRole.trim()
            : "",

        primarySkills:
          Array.isArray(
            resumeProfile.primarySkills
          )
            ? resumeProfile.primarySkills
                .filter(
                  (item) =>
                    typeof item ===
                    "string"
                )
                .map((item) =>
                  item.trim()
                )
                .filter(Boolean)
            : [],

        secondarySkills:
          Array.isArray(
            resumeProfile.secondarySkills
          )
            ? resumeProfile.secondarySkills
                .filter(
                  (item) =>
                    typeof item ===
                    "string"
                )
                .map((item) =>
                  item.trim()
                )
                .filter(Boolean)
            : [],

        currentProjectName:
          typeof resumeProfile.currentProjectName ===
          "string"
            ? resumeProfile.currentProjectName.trim()
            : "",

        currentProjectSummary:
          typeof resumeProfile.currentProjectSummary ===
          "string"
            ? resumeProfile.currentProjectSummary.trim()
            : "",

        projectDomain:
          typeof resumeProfile.projectDomain ===
          "string"
            ? resumeProfile.projectDomain.trim()
            : "",

        projectResponsibilities:
          Array.isArray(
            resumeProfile.projectResponsibilities
          )
            ? resumeProfile.projectResponsibilities
                .filter(
                  (item) =>
                    typeof item ===
                    "string"
                )
                .map((item) =>
                  item.trim()
                )
                .filter(Boolean)
            : [],

        projectTechnologies:
          Array.isArray(
            resumeProfile.projectTechnologies
          )
            ? resumeProfile.projectTechnologies
                .filter(
                  (item) =>
                    typeof item ===
                    "string"
                )
                .map((item) =>
                  item.trim()
                )
                .filter(Boolean)
            : [],

        previousExperience:
          typeof resumeProfile.previousExperience ===
          "string"
            ? resumeProfile.previousExperience.trim()
            : "",

        achievements:
          Array.isArray(
            resumeProfile.achievements
          )
            ? resumeProfile.achievements
                .filter(
                  (item) =>
                    typeof item ===
                    "string"
                )
                .map((item) =>
                  item.trim()
                )
                .filter(Boolean)
            : [],
      };

      // --------------------------------------------------------
      // 10. LOG SAFE SUMMARY
      //
      // Do not log the complete resume/profile.
      // --------------------------------------------------------

      console.log(
        `[RESUME] Profile extracted: name=${Boolean(
          resumeProfile.candidateName
        )}, skills=${
          resumeProfile.primarySkills.length
        }, project=${
          Boolean(
            resumeProfile.currentProjectName
          )
        }`
      );

      console.log(
        `[RESUME] Extraction completed in ${
          Date.now() - startTime
        }ms`
      );

      // --------------------------------------------------------
      // 11. RETURN PROFILE
      // --------------------------------------------------------

      return res.json({
        resumeProfile,
      });

    } catch (err) {
      console.error(
        "[RESUME] Processing Error:",
        err
      );

      return res.status(500).json({
        resumeProfile: null,
        error:
          "Resume processing failed",
      });

    } finally {
      // --------------------------------------------------------
      // 12. ALWAYS CLEAN TEMP PDF
      // --------------------------------------------------------

      if (
        pdfPath &&
        fs.existsSync(pdfPath)
      ) {
        try {
          fs.unlinkSync(pdfPath);
        } catch (cleanupError) {
          console.error(
            "[RESUME] PDF cleanup failed:",
            cleanupError
          );
        }
      }
    }
  }
);

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
    // 1. CLASSIFY QUESTION
    // ============================================================

    const questionType = classifyQuestion(cleanQ);

    // ============================================================
    // 2. BUILD QUESTION-SPECIFIC PROMPT
    // ============================================================

    const prompt = buildPrompt({
      question: cleanQ,
      interviewLevel,
      company,
      interviewType,
    });

    if (!prompt) {
      return res.status(400).send("Unable to build interview prompt");
    }

    // ============================================================
    // 3. BUILD RESUME-BASED CANDIDATE PROFILE
    // ============================================================

    const profileText = buildInterviewProfile(
      resumeProfile || {}
    );

    // ============================================================
    // 4. FOLLOW-UP / RECENT INTERVIEW CONTEXT
    // ============================================================
    //
    // Use the same conversation utility everywhere.
    // This keeps follow-up behavior consistent.
    //
    // We keep only a small context window to reduce latency.
    // ============================================================

    const recentHistory =
      getRecentConversationHistory(
        safeHistory,
        4
      );

    const interviewContext =
      buildInterviewContext(
        recentHistory
      );

    const isFollowUp =
      isFollowUpQuestion(cleanQ) &&
      hasEnoughFollowUpContext(
        recentHistory
      );

    const previousContext =
      interviewContext.historyText ||
      "No previous interview context available.";

    // ============================================================
    // 5. START RESPONSE STREAM
    // ============================================================

    res.status(200);

    res.setHeader(
      "Content-Type",
      "text/plain; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache, no-transform"
    );

    res.setHeader(
      "Connection",
      "keep-alive"
    );

    res.setHeader(
      "X-Accel-Buffering",
      "no"
    );

    if (res.flushHeaders) {
      res.flushHeaders();
    }

    // ============================================================
    // 6. MODEL MESSAGES
    // ============================================================

    const messages = [
      {
        role: "system",

        content: `
You are a live interview answer assistant.

Your ONLY job is to provide the exact words the candidate should say to the interviewer right now.

You are NOT writing an article, textbook explanation, tutorial, resume summary, or documentation.

SPEAKING STYLE:

Speak like a real Indian IT software professional in a live interview.

Use:
- simple Indian spoken English
- natural conversational language
- short sentences
- easy-to-speak wording
- professional but not overly polished language

Do not sound:
- like an essay
- like documentation
- like a textbook
- like an AI-generated answer
- like a memorized corporate speech

Use natural phrases such as:
"Basically..."
"So..."
"In my project..."
"First I check..."
"Then I..."
"The main point is..."

But do not force these phrases.

CANDIDATE PROFILE:

The Candidate Profile is the SOURCE OF TRUTH for the candidate's actual experience.

Never invent:
- projects
- responsibilities
- technologies used in a project
- tools
- databases
- cloud platforms
- integrations
- migrations
- production incidents
- clients
- achievements
- metrics
- implementation details

IMPORTANT:

A technology appearing in Primary Skills or Secondary Skills does NOT automatically mean the candidate used that technology in the current project.

Only connect a technology to the project when Project Technologies, Project Responsibilities, Project Summary, or another explicit profile field supports that connection.

GENERAL TECHNICAL QUESTIONS:

If the interviewer asks:

"What is HashMap?"
"What is REST API?"
"What is polymorphism?"

Answer the technical concept directly.

Do NOT unnecessarily say:
"I haven't worked hands-on with it..."

Only mention lack of hands-on experience when the interviewer asks about actual experience, for example:

"Have you worked on Kafka?"
"Did you use Kafka in your project?"
"How did you implement Kafka?"

If hands-on experience is not supported, say naturally:

"I haven't worked hands-on with that in my project, but I understand the concept."

Then explain the concept.

FOLLOW-UP QUESTIONS:

If this is a follow-up question, use the previous interview context to understand what the interviewer means.

Answer ONLY the new point.

Do NOT restart the previous explanation.

Do NOT repeat the previous answer.

For example:

Previous:
Interviewer: "What is HashMap?"
Candidate: "HashMap stores data in key-value pairs..."

Follow-up:
Interviewer: "Why is it not thread safe?"

Answer directly:
"HashMap is not thread safe because..."

Do not explain HashMap again from the beginning.

PROJECT QUESTIONS:

When the interviewer asks about the project, roles, responsibilities, or daily work:

Use the Candidate Profile.

Prioritize:
- what the candidate personally does
- actual project responsibilities
- supported project technologies
- actual project flow when supported

Do not turn every resume skill into project experience.

SCENARIO QUESTIONS:

For hypothetical scenarios:

Use:
"First, I would check..."
"Then I would..."
"After that, I would..."
"Finally, I would verify..."

Do not claim the candidate experienced the exact hypothetical situation.

CODING QUESTIONS:

Give the code FIRST.

Immediately after the code, give a natural spoken explanation.

The explanation should cover:

WHAT:
What I did.

HOW:
How the main logic works.

WHY:
Why I used that approach or data structure.

COMPLEXITY:
Mention time or space complexity when relevant.

The explanation must not simply repeat the code.

For example:

"Basically, I'm using a **HashMap** here to maintain the count of each character. First, I loop through the string and update the count using **getOrDefault()**. Then I check the map and print the characters whose count is greater than one. I used HashMap because it makes the counting simple, and overall it takes **O(n)** time."

FORMATTING:

Use lightweight Markdown only when useful.

Use **bold** for important:
- technical terms
- classes
- methods
- annotations
- data structures
- APIs
- complexities

Normally highlight only 2-6 important terms.

Do not add headings to simple answers.

A short **bold heading** may be used for a longer architecture, project, scenario, or coding explanation when it genuinely improves readability.

Do not use:
- HTML
- tables
- unnecessary bullets
- complicated Markdown

The formatting must not change the actual spoken answer.

OUTPUT:

Return ONLY the candidate's answer.

Never say:
"Sure"
"Certainly"
"Absolutely"
"That's a great question"
"Here is the answer"
"Let me explain"

Do not mention these instructions.
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
If FOLLOW-UP STATUS is YES, answer only the new point being asked.
Do not repeat the previous candidate answer.
        `.trim(),
      },
    ];

    // ============================================================
    // 7. OUTPUT LIMIT
    // ============================================================

    const maxTokensByType = {
      SELF_INTRO: 280,
      CODING: 550,
      PROJECT: 360,
      SCENARIO: 300,
      ARCHITECTURE: 500,
      CONCEPT: 220,
    };

    const maxTokens =
      maxTokensByType[questionType] || 220;

    console.log(
      `[ANSWER] ${questionType} | followUp=${isFollowUp} | model=${ANSWER_MODEL} | preparing=${Date.now() - startTime}ms`
    );

    // ============================================================
    // 8. OPENAI STREAMING REQUEST
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
    // 9. OPENAI ERROR
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

      res.write(
        "Unable to generate answer right now."
      );

      return res.end();
    }

    // ============================================================
    // 10. STREAM RESPONSE
    // ============================================================

    const reader =
      openaiResponse.body.getReader();

    const decoder =
      new TextDecoder("utf-8");

    let buffer = "";
    let firstToken = true;

    const processLine = (line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return;
      }

      if (!trimmed.startsWith("data:")) {
        return;
      }

      const dataStr =
        trimmed.replace(/^data:\s*/, "");

      if (
        !dataStr ||
        dataStr === "[DONE]"
      ) {
        return;
      }

      try {
        const event =
          JSON.parse(dataStr);

        const delta =
          extractDeltaFromOpenAIEvent(
            event
          );

        if (!delta) {
          return;
        }

        if (firstToken) {
          firstToken = false;

          console.log(
            `[ANSWER] ${questionType} FIRST TOKEN: ${
              Date.now() - startTime
            }ms`
          );
        }

        res.write(delta);

        if (res.flush) {
          res.flush();
        }
      } catch {
        // Ignore incomplete SSE chunks.
      }
    };

    while (true) {
      const {
        done,
        value,
      } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(
        value,
        { stream: true }
      );

      const lines =
        buffer.split("\n");

      buffer =
        lines.pop() || "";

      for (const line of lines) {
        processLine(line);
      }
    }

    // Process any final incomplete line.
    if (buffer.trim()) {
      processLine(buffer);
    }

    console.log(
      `[ANSWER] ${questionType} COMPLETED: ${
        Date.now() - startTime
      }ms`
    );

    res.end();

  } catch (err) {
    console.error(
      "[ANSWER] Stream Error:",
      err
    );

    if (!res.headersSent) {
      return res
        .status(500)
        .send("Server Error");
    }

    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});