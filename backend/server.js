import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import http from "http";
import WebSocket from "ws";

import {
  createClient,
  LiveTranscriptionEvents,
} from "@deepgram/sdk";

const app = express();
const server = http.createServer(app);

const upload = multer({
  dest: "uploads/",
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

// ===========================
// HEALTH CHECK
// ===========================
app.get("/", (req, res) => {
  res.send("Backend Running 🚀");
});

// ===========================
// DEEPGRAM LIVE WEBSOCKET
// ===========================
const wss = new WebSocket.Server({ server });

wss.on("connection", (client) => {
  console.log("React WebSocket Connected");

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error("Missing DEEPGRAM_API_KEY");
    client.close();
    return;
  }

  const dgConnection = deepgram.listen.live({
    model: "nova-3",
    language: "en-US",
    punctuate: true,
    interim_results: true,
    smart_format: true,
    endpointing: 300,
    vad_events: true,
    utterance_end_ms: 1000,
  });

  dgConnection.on(LiveTranscriptionEvents.Open, () => {
    console.log("Deepgram Connected");

    client.on("message", (audioChunk) => {
      if (dgConnection.getReadyState() === 1) {
        dgConnection.send(audioChunk);
      }
    });
  });

  dgConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const transcript = data?.channel?.alternatives?.[0]?.transcript || "";

    if (!transcript.trim()) return;

    const payload = {
      text: transcript,
      isFinal: Boolean(data?.is_final),
      speechFinal: Boolean(data?.speech_final),
    };

    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  });

  dgConnection.on(LiveTranscriptionEvents.Error, (err) => {
    console.error("Deepgram Error:", err);
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ error: "Deepgram transcription error" }));
    }
  });

  dgConnection.on(LiveTranscriptionEvents.Close, () => {
    console.log("Deepgram Closed");
  });

  client.on("close", () => {
    console.log("React WebSocket Closed");
    try {
      dgConnection.finish();
    } catch (err) {
      console.error("Deepgram finish error:", err);
    }
  });
});

// ===========================
// DEEPGRAM FILE TRANSCRIBE
// ===========================
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

    if (error) {
      throw error;
    }

    const text =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

    res.json({ text });
  } catch (err) {
    console.error("Transcription Error:", err);
    res.status(500).json({ text: "Transcription Error" });
  }
});

function buildInterviewPrompt({
  question,
  resumeText,
  interviewLevel,
  company,
  interviewType,
}) {
  return `You are an Indian Java Spring Boot interview assistant.
Answer like the candidate is speaking in a real interview.
Keep it short, confident, practical, and resume-aware.

Candidate Resume:
${resumeText || "Resume not uploaded"}

Interview Context:
Company: ${company || "Generic"}
Level: ${interviewLevel || "Mid Level"}
Type: ${interviewType || "Technical"}

Question:
${question}

Rules:
- Use simple Indian spoken English.
- No textbook theory. Speak like a real candidate.
- Keep Interview Ready Answer around 70 to 100 words.
- Use **bold** for important technical words.
- Always include a project-related answer.
- If resume has matching project information, use it naturally.
- If resume is missing or unrelated, give a safe practical project-style example without fake company names.
- If it is a coding question, include complete working code and short explanation.
- Prefer Java for coding unless another language is clearly asked.

Return only Markdown with this exact structure:

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

  if (event.type === "response.output_text.done") {
    return "";
  }

  if (event.type === "response.message.delta") {
    const content = event.delta?.content || [];
    return content
      .map((item) => item?.text || item?.delta || "")
      .join("");
  }

  return "";
}

// ===========================
// OPENAI STREAMING ANSWER ROUTE
// ===========================
app.post("/answer", async (req, res) => {
  const {
    question,
    resumeText,
    interviewLevel,
    company,
    interviewType,
  } = req.body;

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

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
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
      res.write("Unable to generate answer right now.");
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

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
