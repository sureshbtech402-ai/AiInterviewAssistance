
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

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
7. End naturally with learning interest and professional growth.

SELF-INTRODUCTION RULES:
- Keep it between 140 and 160 words.
- Use short and easy-to-speak sentences.
- Use "currently" and "previously" exactly in the correct project context.
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

function isSelfIntroductionQuestion(question = "") {
  const q = getCleanQuestion(question).toLowerCase().trim();
  if (!q) return false;

  return (
    q.includes("tell me about yourself") ||
    q.includes("tell me about you") ||
    q.includes("about yourself") ||
    q.includes("introduce yourself") ||
    q.includes("self introduction") ||
    q.includes("your self")
  );
}


function isCodingQuestion(question) {
  const q = getCleanQuestion(question).toLowerCase().trim();
  if (!q) return false;

  const strongCodingPatterns = [
    /\bwrite\s+(a|an|the)?\s*(java|python|javascript|sql)?\s*(program|code|function|method|query)\b/,
    /\bwrite code\b/,
    /\bwrite a program\b/,
    /\bimplement\s+(a|an|the)?\s*(program|algorithm|function|method|solution|code)\b/,
    /\bsolve (this|the) coding\b/,
    /\bfind (the )?(second highest|duplicate|duplicates|unique|largest|smallest)\b/,
    /\breverse (a|the)?\s*(string|number|array|list)\b/,
    /\bremove duplicates\b/,
    /\bsort (a|the)?\s*(array|list|string)\b/,
    /\busing streams?\b/,
    /\bsql query\b/,
    /\bprint (only )?(unique|duplicate|duplicates)\b/,
  ];

  return strongCodingPatterns.some((pattern) => pattern.test(q));
}

function isScenarioQuestion(question) {
  const q = getCleanQuestion(question).toLowerCase().trim();
  if (!q) return false;

  const scenarioPatterns = [
    /\btell me about a time\b/,
    /\bcan you explain a situation\b/,
    /\bwhat would you do if\b/,
    /\bhow would you handle\b/,
    /\bhow did you handle\b/,
    /\bhave you faced\b/,
    /\bscenario\b/,
    /\bproduction issue\b/,
    /\bcritical issue\b/,
    /\bdifficult bug\b/,
    /\bperformance issue\b/,
    /\bapi is slow\b/,
    /\bservice is down\b/,
    /\bdeployment failed\b/,
    /\bmerge conflict\b/,
    /\bsecurity vulnerability\b/,
    /\bteam conflict\b/,
    /\bclient escalation\b/,
    /\bfailed transaction\b/,
    /\bdata inconsistency\b/,
    /\bmicroservice failure\b/,
    /\bdeadline\b/,
  ];

  return scenarioPatterns.some((pattern) => pattern.test(q));
}

function isArchitectureQuestion(question) {
  const q = getCleanQuestion(question).toLowerCase().trim();
  if (!q) return false;

  const architecturePatterns = [
    /\barchitecture\b/,
    /\bsystem design\b/,
    /\bdesign pattern\b/,
    /\bend[- ]to[- ]end flow\b/,
    /\brequest flow\b/,
    /\bauthentication flow\b/,
    /\bauthorization flow\b/,
    /\bdeployment flow\b/,
    /\bcommunication flow\b/,
    /\bmicroservice communication\b/,
    /\bhow .* works internally\b/,
    /\bcomponents of\b/,
    /\bhigh level design\b/,
    /\blow level design\b/,
    /\bscalability\b/,
    /\bfault tolerance\b/,
    /\bapi gateway\b/,
    /\bservice discovery\b/,
    /\bcircuit breaker\b/,
    /\bevent[- ]driven\b/,
  ];

  return architecturePatterns.some((pattern) => pattern.test(q));
}

function buildSelfIntroductionPrompt({ question, resumeText }) {
  const cleanQ = getCleanQuestion(question);

  return `You are helping a candidate answer a live interview self-introduction question.

Structured Resume Context:
${resumeText || "Resume details are not available"}

Question:
${cleanQ}

Give exactly ONE recommended self-introduction in natural Indian spoken English.

FOLLOW THIS EXACT FLOW:
1. "Hi, I am [Name]."
2. Total experience, primary role, and current company.
3. Core technical skills.
4. "Currently, I am working on..." followed by the current project, domain, and main responsibilities.
5. "Previously, I worked on..." followed by the previous project and responsibilities, only when explicitly available.
6. Collaboration/development/deployment activities only when supported.
7. Learning interest and career objective.

RULES:
- Use only facts from the resume context.
- Never invent a previous project or company.
- Keep it between 140 and 160 words.
- Use short, easy-to-speak sentences.
- Sound confident and professional, not robotic.
- Do not use Markdown bold inside this introduction because it should read as one clean speech.
- Do not start with "So", "Basically", "Actually", or "Mainly".

Return exactly:

## 🎯 Self Introduction
[One natural spoken introduction]`;
}


function buildCodingPrompt({ question }) {
  const cleanQ = getCleanQuestion(question);

  return `You are helping a Java developer solve a coding question during a live interview.

Question:
${cleanQ}

RULES:
- Use Java unless the interviewer explicitly requests another language.
- Give the simplest complete working solution.
- Prefer normal loops and basic collections.
- Use Java Streams only when the question explicitly asks for streams.
- Avoid advanced logic unless required.
- Use simple variable names.
- Include required imports and a main method when needed.
- Keep comments minimal.
- Do not provide multiple solutions unless requested.
- Bold the important explanation keywords such as **approach**, **loop**, **condition**, and **time complexity**.

Return only this format:

## 💻 Simple Code
\`\`\`java
[Complete working code]
\`\`\`

## 🎤 How to Explain
[Explain the logic naturally in 3 to 5 short sentences.]`;
}

function buildScenarioPrompt({ question, resumeText }) {
  const cleanQ = getCleanQuestion(question);

  return `You are helping a Java Backend Developer answer a scenario-based live interview question.

Structured Resume Context:
${resumeText || "Resume summary is not available"}

Interview Question:
${cleanQ}

TASK:
Understand the scenario, check the resume context for the closest matching experience, and create a meaningful answer the candidate can speak directly.

RULES:
- Use simple, natural Indian spoken English.
- Use "I", "my team", and "in my project" naturally.
- Use only facts available in the resume.
- Never invent incidents, tools, numbers, achievements, clients, or results.
- When the resume supports the scenario, connect it with the relevant project, responsibility, and technology.
- When the exact incident is not present, clearly say: "I have not faced the exact same situation, but based on my project experience, I would handle it in this way."
- Explain the situation, responsibility, technical actions, result or expected outcome, and prevention or learning.
- Highlight important technical actions and technologies using Markdown bold.
- Keep the answer between 140 and 220 words.
- Do not start with "So", "Basically", "Actually", or "Mainly".

Return exactly:

## 🎯 Scenario Answer
[Natural spoken interview answer]

## 📌 Key Actions
- [3 to 4 short technical actions with important keywords bolded]`;
}

function buildArchitecturePrompt({ question, resumeText }) {
  const cleanQ = getCleanQuestion(question);

  return `You are helping a Java Backend Developer answer a broad architecture, design, or end-to-end flow question in a live interview.

Candidate Resume Context:
${resumeText || "Resume summary is not available"}

Question:
${cleanQ}

ARCHITECTURE ANSWER RULES:
- First answer the general concept correctly for ANY business domain. Do not restrict the answer only to the candidate's project domain.
- Explain enough subtopics so the candidate can continue speaking when the interviewer asks deeper questions.
- Use simple, natural Indian spoken English.
- Highlight every important component, technology, flow step, advantage, and technical keyword using Markdown bold.
- Do not only list component names; briefly explain what each component does.
- Explain communication, data handling, security, fault tolerance, scalability, monitoring, and deployment when they are relevant to the asked architecture.
- Connect to the candidate's project only in the final project section and only when supported by the resume.
- Never invent project-specific components.
- Keep the answer around 300 to 450 words depending on complexity.
- Avoid repeated content and difficult corporate wording.

Return exactly this useful structure:

## 🎯 Definition
[Direct spoken definition with important keywords bolded]

## 🧩 Main Components
- **Component:** Brief purpose
- Add 4 to 7 relevant components

## 🔄 Step-by-Step Working Flow
1. Explain the request or event flow clearly.
2. Continue until response, storage, or processing is completed.

## ✅ Advantages
- Add 3 to 5 meaningful advantages.

## 💡 Real-Time Example
[Give one simple domain-neutral or suitable business example.]

## 📄 Project Connection
[Connect naturally with the resume only when supported. Otherwise say how the concept can generally be applied without claiming direct experience.]`;
}

function buildConceptPrompt({ question, resumeText }) {
  const cleanQ = getCleanQuestion(question);

  return `You are helping a Java Backend Developer answer a live technical interview question.

Candidate Context:
${resumeText || "Java Backend Developer with Spring Boot and Microservices experience"}

Interview Question:
${cleanQ}

RULES:
- Answer exactly as the candidate can speak directly to the interviewer.
- Use simple and natural Indian spoken English.
- Start directly with the definition or main difference.
- Highlight all important technical terms and differences using Markdown bold.
- For comparison questions, explain both concepts clearly and then state the main difference.
- Mention project usage only when the resume genuinely supports it.
- Never invent project usage.
- Do not use difficult or exaggerated words.
- Do not start with "So", "Basically", "Actually", or "Mainly".

ANSWER LENGTH:
- Small concept, annotation, keyword, collection, or difference: 90 to 140 words.
- Practical or project-related concept: 120 to 180 words.
- Do not repeat the same information.

Return exactly:

## 🎯 Best Interview Answer
[Direct natural spoken answer with important keywords bolded]

## 📌 Real-Time-Use
- [3 to 5 concise Real-Time-Use points with important keywords bolded]`;
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
  const { question, resumeText, interviewLevel, company, interviewType, history } =
    req.body || {};

  const cleanQ = getCleanQuestion(question);

  if (!cleanQ || !cleanQ.trim()) {
    return res.status(400).send("Question is empty");
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).send("OPENAI_API_KEY is missing");
  }

  try {
    let prompt = "";
    
    if (isSelfIntroductionQuestion(cleanQ)) {
      prompt = buildSelfIntroductionPrompt({ question: cleanQ, resumeText });
    } else if (isCodingQuestion(cleanQ)) {
      prompt = buildCodingPrompt({ question: cleanQ });
    } else if (isScenarioQuestion(cleanQ)) {
      prompt = buildScenarioPrompt({ question: cleanQ, resumeText });
    } else if (isArchitectureQuestion(cleanQ)) {
      prompt = buildArchitecturePrompt({ question: cleanQ, resumeText });
    } else {
      prompt = buildConceptPrompt({ question: cleanQ, resumeText });
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    // Inject history to maintain conversational memory for follow-up questions
    const messages = [];
    messages.push({
      role: "system",
      content: `You are a live interview answer assistant.
Give direct, natural, easy-to-speak answers in simple Indian English.
Use Markdown headings, bullets, numbering, and **bold keywords** exactly as requested by the active prompt.
Never invent resume or project facts.
Use the recent conversation messages to understand follow-up questions.
When the new question is short, such as "why", "how", "explain more", "what about that", or "give an example", connect it to the immediately previous question and answer.
Do not repeat the complete previous answer. Continue from the relevant point and answer only the follow-up.
For architecture questions, provide sufficient depth, components, flow, considerations, advantages, example, and project connection.
For coding questions, provide the simplest working code.`
    });

    if (Array.isArray(history) && history.length > 0) {
      const recentHistory = history.slice(-6);

      recentHistory.forEach((turn) => {
        messages.push({
          role: turn.role === "assistant" ? "assistant" : "user",
          content: String(turn.content || "").slice(0, 1500),
        });
      });
    }

    const recentUserQuestion = Array.isArray(history)
      ? [...history]
          .reverse()
          .find((turn) => turn?.role === "user")?.content
      : "";

    const recentAssistantAnswer = Array.isArray(history)
      ? [...history]
          .reverse()
          .find((turn) => turn?.role === "assistant")?.content
      : "";

    if (recentUserQuestion || recentAssistantAnswer) {
      prompt = `${prompt}

FOLLOW-UP CONTEXT:
Previous question: ${String(
        recentUserQuestion || ""
      ).slice(0, 1200)}

Previous answer: ${String(
        recentAssistantAnswer || ""
      ).slice(0, 1800)}

IMPORTANT: If the current question refers to the previous topic using words like "it", "that", "this", "why", "how", "more", "example", or is otherwise incomplete by itself, answer it as a continuation of the previous question. Do not restart from the beginning.`;
    }

    // Push prompt instructions as the immediate next instruction
    messages.push({
      role: "user",
      content: prompt,
    });

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
        max_completion_tokens: isCodingQuestion(cleanQ)
          ? 650
          : isArchitectureQuestion(cleanQ)
            ? 1000
            : isScenarioQuestion(cleanQ)
              ? 650
              : 450,
      }),
    });

    if (!openaiResponse.ok || !openaiResponse.body) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI Stream Error:", errorText);
      res.write("Unable to generate answer right now. Please try again.");
      return res.end();
    }

    if (typeof openaiResponse.body.getReader === "function") {
      const reader = openaiResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part
            .split("\n")
            .filter((line) => line.startsWith("data:"));

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
            } catch (err) {
              console.error("OpenAI stream parse error:", err);
            }
          }
        }
      }
    } else if (typeof openaiResponse.body[Symbol.asyncIterator] === "function") {
      const decoder = new TextDecoder();
      let buffer = "";

      for await (const chunk of openaiResponse.body) {
        buffer += decoder.decode(chunk, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part
            .split("\n")
            .filter((line) => line.startsWith("data:"));

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
            } catch (err) {
              console.error("OpenAI stream parse error:", err);
            }
          }
        }
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
