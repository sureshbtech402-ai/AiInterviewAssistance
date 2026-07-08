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
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
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
    You are a strict resume extraction engine.

    Extract ONLY facts explicitly present in the resume.
    Do NOT guess.
    Do NOT infer.
    Do NOT invent company names.
    Do NOT invent years of experience.
    Do NOT invent project names.
    Do NOT invent achievements or percentages.
    If any value is missing, keep it empty.

    Resume:
    ${resumeText}

    Return ONLY valid JSON. No markdown. No explanation.

    {
      "candidateSummary": "",
      "experience": "",
      "primarySkills": [],
      "secondarySkills": [],
      "projectName": "",
      "projectDomain": "",
      "projectSummary": "",
      "rolesAndResponsibilities": [],
      "toolsAndTechnologies": [],
      "achievements": [],
      "selfIntroduction": "",
      "projectExplanation": "",
      "rolesExplanation": ""
    }
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: prompt,
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

    let text = data.output_text || "{}";

    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const resumeProfile = JSON.parse(text);
    console.log("OUTPUT TEXT:");
    console.log(text);

    res.json({ resumeProfile });
  } catch (err) {
    console.error("Resume Summary Error:", err);
    res.status(500).json({
      resumeProfile: null,
    });
  }
});

function isSpecialQuestion(question = "") {
  const q = question.toLowerCase();

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

function buildSpecialPrompt({
  question,
  resumeText,
  company,
  interviewLevel,
  interviewType,
}) {
  return `
You are a senior Indian interview coach.

The question is a profile/project/responsibility question.
Answer as the candidate speaking in a real interview.

Resume Profile:
${resumeText || "Resume profile not available"}

Level: ${interviewLevel || "Mid Level"}
Type: ${interviewType || "Technical"}

Question:
${question}

Rules:
- Do NOT use selected company name unless it is clearly present in Resume Profile.
- Do NOT say currently working at company from dropdown.
- Use only actual resume details.
- Do NOT invent achievements, metrics, clients, or cloud projects.
- If data is missing, keep it generic without numbers.
- Use natural Indian spoken English.
- Answer confidently.
- Do not sound like textbook.
- Do not say "according to my resume".
- Keep answer around 100-120 words.
- Start immediately. Avoid extra points if not needed.
- Mention experience, main skills, project, responsibilities naturally.
- Use **bold** for important technologies.
- Never invent fake company names.

Return only Markdown:

## 🎯 Interview Ready Answer

## ⭐ Key Points
-
-
-

## 📄 Project Related Answer
`;
}

function buildInterviewPrompt({
  question,
  resumeText,
  interviewLevel,
  company,
  interviewType,
}) {
  if (isSpecialQuestion(question)) {
    return buildSpecialPrompt({
      question,
      resumeText,
      interviewLevel,
      company,
      interviewType,
    });
  }

  return `You are a senior Indian Java Spring Boot interview coach.
Reply as if the candidate is speaking in a real interview.

Resume Profile:
${resumeText || "Resume profile not available"}

Company: ${company || "Generic"}
Level: ${interviewLevel || "Mid Level"}
Type: ${interviewType || "Technical"}

Question:
${question}

Rules:
- Start directly with the answer.
- Use simple Indian spoken English.
- No textbook explanation.
- No long theory.
- Interview Ready Answer: 100-120 words.
- Use **bold** for important technical keywords.
- Always include a project-related answer.
- If resume profile is relevant, connect naturally with project experience.
- If resume profile is not enough, give a safe practical implementation example.
- For coding/program/query questions, include complete working code, complexity, output if useful, and simple explanation.
- Prefer Java unless another language is clearly asked.

Return only Markdown:

## 🎯 Interview Ready Answer

## ⭐ Key Points
-
-
-

## 📄 Project Related Answer

## 💻 Code
Only include this section if coding is required. Use fenced code block.

## ⏱ Complexity
Only include this section if coding is required.

## 📘 Code Explanation
Only include this section if coding is required.`;
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
