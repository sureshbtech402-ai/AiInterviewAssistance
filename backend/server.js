import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import http from "http";
import WebSocket from "ws";

import OpenAI from "openai";

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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Test route
app.get("/", (req, res) => {
  res.send("Backend Running");
});

/* ===========================
   DEEPGRAM LIVE WEBSOCKET
=========================== */

const wss = new WebSocket.Server({
  server,
});

wss.on("connection", (client) => {
  console.log("React WebSocket Connected");

  const dgConnection = deepgram.listen.live({
    model: "nova-3",
    language: "en",
    punctuate: true,
    interim_results: true,
    smart_format: true,
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
    const transcript =
      data?.channel?.alternatives?.[0]?.transcript || "";

    if (transcript.trim()) {
      console.log("Transcript:", transcript);

      if (client.readyState === WebSocket.OPEN) {
        client.send(transcript);
      }
    }
  });

  dgConnection.on(LiveTranscriptionEvents.Error, (err) => {
    console.error("Deepgram Error:", err);
  });

  dgConnection.on(LiveTranscriptionEvents.Close, () => {
    console.log("Deepgram Closed");
  });

  client.on("close", () => {
    console.log("React WebSocket Closed");
    dgConnection.finish();
  });
});

/* ===========================
   DEEPGRAM FILE TRANSCRIBE
=========================== */

app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        text: "No audio file received",
      });
    }

    const audioBuffer = fs.readFileSync(req.file.path);

    const { result, error } =
      await deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: "nova-3",
          language: "en",
          punctuate: true,
          smart_format: true,
        }
      );

    fs.unlinkSync(req.file.path);

    if (error) {
      throw error;
    }

    const text =
      result?.results?.channels?.[0]?.alternatives?.[0]
        ?.transcript || "";

    res.json({
      text,
    });
  } catch (err) {
    console.error("Transcription Error:", err);

    res.status(500).json({
      text: "Transcription Error",
    });
  }
});

/* ===========================
   OPENAI ANSWER ROUTE
=========================== */

app.post("/answer", async (req, res) => {
  try {
    const {
      question,
      resumeText,
      interviewLevel,
      company,
      interviewType,
    } = req.body;

    const prompt = `
You are an Indian Java Spring Boot interview assistant.

Answer like the candidate is speaking in a real interview.

Candidate Resume:
${resumeText || "Resume not uploaded"}

Company:
${company || "Generic"}

Interview Level:
${interviewLevel || "Mid Level"}

Interview Type:
${interviewType || "Technical"}

Question:
${question}

STRICT RULES:
1. Use simple Indian spoken English.
2. Do NOT give textbook theory.
3. Do NOT give long explanation.
4. Interview Ready Answer must be 80-130 words only.
5. Key Points must be 3-5 short points.
6. Project Answer must always be filled.
7. Use **bold** for important words.
8. If resume has project details, connect naturally.
9. If resume is missing, give safe project-style answer without fake company data.

CODING RULES:
If question asks code/program/query/algorithm:
- Give complete working code.
- Prefer Java unless another language is asked.
- Add timeComplexity.
- Add spaceComplexity.
- Add sample output if possible.
- Add simple codeExplanation.

If not coding:
- code = ""
- language = ""
- timeComplexity = ""
- spaceComplexity = ""
- output = ""
- codeExplanation = ""

Return ONLY valid JSON:

{
  "answer": "",
  "keyPoints": ["", "", ""],
  "projectAnswer": "",
  "code": "",
  "language": "",
  "timeComplexity": "",
  "spaceComplexity": "",
  "output": "",
  "notes": "",
  "codeExplanation": ""
}
`;

    const response = await openai.responses.create({
      model: "gpt-5.5",
      input: prompt,
    });

    let responseText = response.output_text || "";

    responseText = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(responseText);

    res.json(parsed);
  } catch (err) {
    console.error("Answer Error:", err);

    res.status(500).json({
      answer: "Server Error",
      keyPoints: [],
      projectAnswer: "",
      code: "",
      language: "",
      timeComplexity: "",
      spaceComplexity: "",
      output: "",
      notes: "",
      codeExplanation: "",
    });
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});