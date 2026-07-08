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

/* =====================================================
   DEEPGRAM LIVE WEBSOCKET
   Frontend sends WebM/Opus audio chunks.
   Backend streams them to Deepgram Nova-3 and returns
   interim/final transcript JSON to the frontend.
===================================================== */

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

/* =====================================================
   DEEPGRAM FILE TRANSCRIPTION FALLBACK
===================================================== */

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

/* =====================================================
   RESUME SUMMARY EXTRACTION ENDPOINT
===================================================== */
app.post("/resume-summary", async (req, res) => {
  try {
    const { resumeText } = req.body;

    if (!resumeText) {
      return res.status(400).json({ resumeProfile: null });
    }

    const prompt = `
    You are an elite resume extraction and interview preparation engine.

    First, extract ONLY facts explicitly present in the resume.
    Do NOT guess, infer, or invent details (no fake company names, years, projects, or metrics).
    If any value is missing, keep it empty.

    Second, when writing the conversational fields ("selfIntroduction", "projectExplanation", "rolesExplanation"), you must adhere to these CRITICAL SPOKEN TONE RULES:
    1. BAN WEAK FILLERS & CASUAL OPENINGS: Do NOT start any sentence or bullet point with words like "So,", "Basically,", "Mainly,", "Actually,", "Like,", "As such,", or "I am...".
    2. ELITE AND CONFIDENT OPENINGS: Start spoken answers with high-impact transitions (e.g., "Certainly, to provide an overview, my name is...", "Over the past three years, my primary technical focus has been on...", "I specialize in...").
    3. INTEGRATE SPECIFIC FACTS: Weave in real, specific details from the resume context (such as exact college names, real projects like ING Bank, specific architectural migrations, and their primary tech stack components). Do not use generic placeholders.
    4. ACTION VERB BULLET MANDATE: For roles and responsibilities, every single point must begin directly with a strong, active technical verb (e.g., "Implemented...", "Developed...", "Architected...", "Optimized..."). 
    5. STRICT NO PRONOUNS RULE FOR BULLETS: Absolutely never start bullet points with personal pronouns or conversational descriptors (e.g., do NOT start with "I...", "We...", "My...", "Mainly...", "Also...", "Additionally..."). Start directly with the technical verb.

    Resume Content:
    ${resumeText}

    Return the data matching this exact JSON schema:
    {
      "candidateSummary": "A brief professional summary of the candidate.",
      "experience": "Total experience extracted.",
      "primarySkills": ["List of core skills"],
      "secondarySkills": ["List of supportive skills"],
      "projectName": "Major project name",
      "projectDomain": "Project domain",
      "projectSummary": "Brief overview of the project",
      "rolesAndResponsibilities": ["Responsibility 1 starting with active verb directly", "Responsibility 2 starting with active verb directly"],
      "toolsAndTechnologies": ["Tech stack list"],
      "achievements": ["Explicit achievements if any"],
      "selfIntroduction": "A highly polished, elite, and professional spoken self-introduction based strictly on the resume facts. No informal starters.",
      "projectExplanation": "A 2-3 line spoken-ready, professional explanation of the project context and technical transition.",
      "rolesExplanation": "A professional spoken description of core technical ownership starting with action verbs directly."
    }
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Optimized for ultra-fast response times
        response_format: { type: "json_object" }, // Forces raw JSON return, eliminating parsing errors
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1, // Keeps the extraction deterministic, fast, and strict
      }),
    });

    const data = await response.json();
    console.log("========== OPENAI RESPONSE ==========");
    console.log(JSON.stringify(data, null, 2));
    console.log("=====================================");

    if (!response.ok) {
      console.error("Resume Summary OpenAI Error:", data);
      return res.json({
        resumeProfile: null,
      });
    }

    const text = data.choices[0].message.content.trim();
    console.log("OUTPUT TEXT:");
    console.log(text);

    const resumeProfile = JSON.parse(text);
    res.json({ resumeProfile });

  } catch (err) {
    console.error("Resume Summary Error:", err);
    res.status(500).json({
      resumeProfile: null,
    });
  }
});

/* =====================================================
   PROMPT DYNAMIC BUILDERS & INPUT PARSERS
===================================================== */

/**
 * Safely extracts a string from the question parameter,
 * even if it's passed as an object, undefined, or null.
 */
function getCleanQuestion(question) {
  if (!question) return "";
  if (typeof question === "string") return question;
  if (typeof question === "object") {
    return question.question || question.text || question.transcript || JSON.stringify(question);
  }
  return String(question);
}

function isSpecialQuestion(question = "") {
  const cleanQ = getCleanQuestion(question).toLowerCase().trim();
  if (!cleanQ) return false;

  return (
    cleanQ.includes("tell me about yourself") ||
    cleanQ.includes("tell me about you") ||
    cleanQ.includes("about yourself") ||
    cleanQ.includes("about you") ||
    cleanQ.includes("your self") ||
    cleanQ.includes("yourself") ||
    cleanQ.includes("introduce yourself") ||
    cleanQ.includes("self introduction") ||
    cleanQ.includes("explain your project") ||
    cleanQ.includes("about your project") ||
    cleanQ.includes("current project") ||
    cleanQ.includes("roles and responsibilities") ||
    cleanQ.includes("responsibilities") ||
    cleanQ.includes("daily activities") ||
    cleanQ.includes("project architecture")
  );
}

/**
 * Helper to detect if the interviewer's question explicitly asks for coding/queries.
 */
function isCodingQuestion(question) {
  const cleanQ = getCleanQuestion(question).toLowerCase().trim();
  if (!cleanQ) return false;

  const codingKeywords = [
    "code", "program", "write a", "implement", "coding", "function", "snippet", 
    "algorithm", "query", "sql", "database schema", "class", "method", "compile", 
    "regex", "syntax"
  ];
  return codingKeywords.some(keyword => cleanQ.includes(keyword));
}

/**
 * Builds the special spoken prompt for self-introductions or roles/project walkthroughs.
 */
function buildSpecialPrompt({
  question,
  resumeText,
  interviewLevel,
  interviewType,
}) {
  const cleanQ = getCleanQuestion(question);
  return `You are an elite technical interview preparation engine. Translate the candidate's resume into a highly polished, natural, and powerful spoken response.

Resume Context:
${resumeText || "Resume profile not available"}

Interview Parameter: Level: ${interviewLevel || "Mid Level"}, Type: ${interviewType || "Technical"}
Question: ${cleanQ}

INSTRUCTIONS FOR THE PERFECT SELF-INTRODUCTION (🎯 Self Introduction):
- Do NOT use generic placeholder introductions (e.g., "I am an IT professional...").
- Be highly specific: Seamlessly integrate real resume highlights, such as their primary tech stack (e.g., Java, Spring Boot, Hibernate), real company/project names (e.g., ING Bank), and major technical transformations (e.g., migrating a monolithic application to a microservice architecture).
- Sound conversational and confident when spoken aloud. Use professional spoken contractions naturally (e.g., "I'm", "I've", "we've").
- BAN WEAK FILLERS: Absolutely never start any sentence with "So,", "Basically,", "Mainly,", "Actually,", "Like,", or "As such,".
- Begin with a premium, elite transition (e.g., "Certainly, to provide an overview, my name is...", "Over the past three years, my primary technical focus has been on...").

INSTRUCTIONS FOR TECHNICAL ACTION BULLETS (⭐ Roles and Responsibilities):
- Create exactly 3 high-impact bullet points demonstrating core technical ownership.
- CRITICAL RULE: Every single bullet point MUST begin directly with a strong, active technical verb (e.g., "Implemented...", "Developed...", "Architected...", "Optimized...").
- STRICTLY BAN starting bullet points with pronouns or conversational fillers (e.g., do NOT start with "I...", "We...", "My...", "Mainly...", "Also...", "Additionally..."). Start directly with the technical verb!

Return exactly this Markdown structure and nothing else:

## 🎯 Self Introduction
[Insert the highly polished, specific, conversational spoken response here]

## ⭐ Roles and Responsibilities
- [Active Technical Verb]...
- [Active Technical Verb]...
- [Active Technical Verb]...`;
}

/**
 * Builds the concept or coding interview prompt dynamically depending on whether code is asked.
 */
function buildInterviewPrompt({
  question,
  resumeText,
  interviewLevel,
  interviewType,
}) {
  const cleanQ = getCleanQuestion(question);
  if (isSpecialQuestion(cleanQ)) {
    return buildSpecialPrompt({
      question: cleanQ,
      resumeText,
      interviewLevel,
      interviewType,
    });
  }

  const requiresCoding = isCodingQuestion(cleanQ);

  return `You are an elite technical interview coach. Deliver a highly polished, spoken explanation combined with real experience from the resume.

Resume Context:
${resumeText || "Resume profile not available"}

Question: ${cleanQ}

INSTRUCTIONS FOR SPOKEN TONE (🎯 Interview Ready Answer):
- Start directly with the answer as if replying live in an interview. No introductory pleasantries.
- Use professional technical conversational bridges (e.g., "In a practical scenario...", "From an architectural standpoint...", "We actually faced these challenges when...").
- Keep the vocabulary sharp, confident, and professional.
- BAN WEAK FILLERS: Do NOT start sentences with "So,", "Basically,", "Mainly,", "Actually,", "Like,", or "As such,".
- Connect the concept directly to the candidate's real resume experience (e.g., their experience with Spring Boot, Microservices, or Hibernate).

INSTRUCTIONS FOR KEY TAKEAWAYS (⭐ Key Points):
- Create 2-3 high-impact takeaway bullet points.
- CRITICAL RULE: Every bullet point MUST begin directly with a strong, active technical verb (e.g., "Leveraged...", "Designed...", "Configured...", "Optimized..."). 
- STRICTLY BAN starting bullet points with pronouns or fillers (e.g., do NOT start with "I...", "We...", "My...", "Mainly...", "Also...", "Additionally..."). Start directly with the technical verb!

INSTRUCTIONS FOR PROJECT LINK (📄 Project Related Answer):
- Provide a short 2-3 line conversational application tying this technical concept directly to a specific technology or ownership item listed on their resume.

${
  requiresCoding 
    ? `- Since this is a coding question, provide a brief mental approach, followed by the complete working code block, and complexity analysis.` 
    : `- Since this is a conceptual question, do NOT include any code block, code template, or complexity section.`
}

Return exactly this Markdown structure:

## 🎯 Interview Ready Answer
[Insert the conversational spoken explanation here]

## ⭐ Key Points
- [Active Technical Verb]...
- [Active Technical Verb]...

## 📄 Project Related Answer
[2-3 line conversational application linking this concept directly to the resume stack]${
  requiresCoding 
    ? `\n\n## 💻 Code\n[Provide the complete working code block here]\n\n## ⏱ Complexity\n- Time Complexity: O(...)\n- Space Complexity: O(...)` 
    : ""
}`;
}

function extractDeltaFromOpenAIEvent(event) {
  if (!event || typeof event !== "object") return "";

  // Handle standard OpenAI Chat Completions stream chunks (choices[0].delta.content)
  if (event.choices && Array.isArray(event.choices) && event.choices[0]) {
    const delta = event.choices[0].delta;
    return delta?.content || "";
  }

  // Fallbacks
  if (event.type === "response.output_text.delta") {
    return event.delta || "";
  }

  if (event.type === "response.message.delta") {
    const content = event.delta?.content || [];
    return content.map((item) => item?.text || item?.delta || "").join("");
  }

  return "";
}

/* =====================================================
   OPENAI STREAMING ANSWER ROUTE
   Streams plain Markdown chunks to the frontend.
===================================================== */

app.post("/answer", async (req, res) => {
  const { question, resumeText, interviewLevel, company, interviewType } =
    req.body || {};

  const cleanQ = getCleanQuestion(question);

  if (!cleanQ || !cleanQ.trim()) {
    return res.status(400).send("Question is empty");
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).send("OPENAI_API_KEY is missing");
  }

  try {
    const prompt = buildInterviewPrompt({
      question: cleanQ,
      resumeText,
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

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        stream: true,
        temperature: 0.7, // Fixed to 0.7 for natural, varied, and expressive conversational speech
      }),
    });

    if (!openaiResponse.ok || !openaiResponse.body) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI Stream Error:", errorText);
      res.write("Unable to generate answer right now. Please try again.");
      return res.end();
    }

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