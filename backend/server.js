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
    1. BAN WEAK FILLERS: Do NOT start any sentence or bullet point with words like "So,", "Basically,", "Mainly,", "Actually,", "Like,", or "As such,".
    2. ELITE AND CONFIDENT OPENINGS: Start spoken answers with high-impact transitions (e.g., "Certainly, to provide an overview, my name is...", "Over the past three years, my primary focus has been on...", "I specialize in...").
    3. SPOKEN CONTRACTIONS: Use professional spoken contractions (e.g., "I'm", "I've", "we've") to keep it natural but highly polished. Do not sound like a dry textbook.
    4. ACTION VERB MANDATE: For roles and responsibilities, every single point must begin directly with a strong, active technical verb (e.g., "Implemented...", "Developed...", "Architected...", "Optimized...").

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
      "rolesAndResponsibilities": ["Responsibility 1 starting with active verb", "Responsibility 2 starting with active verb"],
      "toolsAndTechnologies": ["Tech stack list"],
      "achievements": ["Explicit achievements if any"],
      "selfIntroduction": "A highly polished, elite, and professional spoken self-introduction based strictly on the resume facts. No informal starters.",
      "projectExplanation": "A 2-3 line spoken-ready, professional explanation of the project context and technical transition.",
      "rolesExplanation": "A professional spoken description of core technical ownership starting with action verbs."
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

function isSpecialQuestion(question = "") {
  const q = question.toLowerCase().trim;

  return (
    q.includes("tell me about yourself") ||
    q.includes("tell me about you") ||
    q.includes("about yourself") ||
    q.includes("about you") ||
    q.includes("your self") ||
    q.includes("yourself") ||
    q.includes("introduce yourself") ||
    q.includes("self introduction") ||
    q.includes("explain your project") ||
    q.includes("about your project") ||
    q.includes("current project") ||
    q.includes("roles and responsibilities") ||
    q.includes("responsibilities") ||
    q.includes("daily activities") ||
    q.includes("project architecture")
  );
}

/**
 * Helper to detect if the interviewer's question explicitly asks for coding/queries.
 */
function isCodingQuestion(question) {
  const lower = question.toLowerCase();
  const codingKeywords = [
    "code", "program", "write a", "implement", "coding", "function", "snippet", 
    "algorithm", "query", "sql", "database schema", "class", "method", "compile", 
    "regex", "syntax"
  ];
  return codingKeywords.some(keyword => lower.includes(keyword));
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
  return `You are a technical interview simulator translating a resume into natural spoken responses.

Resume Context:
${resumeText || "Resume profile not available"}

Interview Parameter: Level: ${interviewLevel || "Mid Level"}, Type: ${interviewType || "Technical"}
Question: ${question}

INSTRUCTIONS FOR NATURAL CONVERSATIONAL TONE:
- Write exactly how a candidate naturally talks when answering live. 
- Use active first-person spoken transitions (e.g., "Certainly, to provide an overview...", "Over the past few years, my core focus has been...").
- BAN WEAK FILLERS: Do NOT start sentences or bullet points with words like "So,", "Basically,", "Mainly,", "Actually,", "Like,", or "As such,".
- Use professional spoken contractions (I've, I'm, we've) naturally.
- Do not make up any factual data, company names, or metrics not found in the resume context.

Return exactly this Markdown structure and nothing else:

## 🎯 Self Introduction
[Insert the conversational spoken response here]

## ⭐ Roles and Responsibilities
- Provide a brief spoken bullet point highlighting a key ownership area from the resume.
- Provide a second spoken bullet point.
- Provide a third spoken bullet point.`;
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
  if (isSpecialQuestion(question)) {
    return buildSpecialPrompt({
      question,
      resumeText,
      interviewLevel,
      interviewType,
    });
  }

  const requiresCoding = isCodingQuestion(question);

  return `You are a technical interview simulator. Deliver a spoken explanation to a technical question combined with real experience from the resume.

Resume Context:
${resumeText || "Resume profile not available"}

Question: ${question}

INSTRUCTIONS FOR SPOKEN TONE:
- Start directly with the answer as if replying in a live conversation.
- Use professional technical conversational bridges (e.g., "The way I look at it...", "In a practical scenario...", "We actually faced this when...").
- Focus on practical delivery over heavy textbook definitions.
- Keep the language elite, confident, and professional. 
- BAN WEAK FILLERS: Do NOT start sentences with "So,", "Basically,", "Mainly," or "Actually,".
${
  requiresCoding 
    ? `- Since this is a coding question, provide a brief mental approach, followed by the complete working code block, and complexity analysis.` 
    : `- Since this is a conceptual question, do NOT include any code block, code template, or complexity section.`
}

Return exactly this Markdown structure:

## 🎯 Interview Ready Answer
[Insert the conversational spoken explanation here]

## ⭐ Key Points
- A spoken takeaway point.
- Another spoken takeaway point.

## 📄 Project Related Answer
[Provide a short 2-3 line conversational application tying this concept directly to a technology or responsibility listed in the resume]${
  requiresCoding 
    ? `\n\n## 💻 Code\n[Provide the complete working code block here]\n\n## ⏱ Complexity\n- Time Complexity: O(...)\n- Space Complexity: O(...)` 
    : ""
}`;
}


function extractDeltaFromOpenAIEvent(event) {
  if (!event || typeof event !== "object") return "";

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

  if (!question || !question.trim()) {
    return res.status(400).send("Question is empty");
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).send("OPENAI_API_KEY is missing");
  }

  try {
    const prompt = buildInterviewPrompt({
      question,
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

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: prompt,
        stream: true,
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
