
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
    // -----------------------------------------
    // 1. Check OpenAI API key
    // -----------------------------------------
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        resumeProfile: null,
        error: "OPENAI_API_KEY is missing",
      });
    }

    // -----------------------------------------
    // 2. Check uploaded resume
    // -----------------------------------------
    if (!req.file) {
      return res.status(400).json({
        resumeProfile: null,
        error: "Resume PDF is required",
      });
    }

    // -----------------------------------------
    // 3. Read PDF
    // -----------------------------------------
    const pdfPath = req.file.path;
    const pdfBuffer = fs.readFileSync(pdfPath);

    // Delete temporary uploaded file
    fs.unlinkSync(pdfPath);

    const pdfBase64 = pdfBuffer.toString("base64");

    // -----------------------------------------
    // 4. Resume analysis prompt
    // -----------------------------------------
    const prompt = `
You are a strict resume extraction and interview preparation assistant.

Read the uploaded resume carefully.

IMPORTANT:

- Use ONLY information explicitly present in the resume.
- Never guess.
- Never invent.
- Never add technologies that are not in the resume.
- Never add projects that are not in the resume.
- Never add responsibilities that are not in the resume.
- Never add companies, dates, experience, numbers or achievements that are not in the resume.
- If information is missing, return "" or [].

==================================================
CANDIDATE ROLE
==================================================

Identify the candidate's actual technical role from the resume.

Do NOT blindly use HR/designation titles such as:

Associate System Engineer
Programmer Analyst
Graduate Engineer Trainee
Software Engineer Trainee

Instead determine the technical role from:

- Skills
- Technologies
- Projects
- Responsibilities
- Experience

Examples:

Java + Spring Boot + Hibernate + REST APIs + Microservices
=> Java Backend Developer

Java + Spring MVC
=> Java Developer

Selenium + TestNG + Automation
=> Automation Test Engineer

React + Angular
=> Frontend Developer

React + Spring Boot
=> Full Stack Developer

AWS + Docker + Kubernetes + CI/CD
=> DevOps Engineer

==================================================
SELF INTRODUCTION
==================================================

Generate ONE natural interview-ready self introduction.

Use simple Indian spoken English.

It should sound like a real candidate speaking.

Do NOT sound like ChatGPT.

Do NOT sound like documentation.

Follow this flow:

1. Start with:

"Hi, I am Candidate Name."

2. Mention:

- Technical role
- Current company
- Total experience

3. Mention only the strongest 6-10 technologies.

4. Explain the current project naturally:

- Project name
- Domain/client
- What the application does
- Main responsibilities

5. Mention previous project ONLY if it is explicitly available in the resume.

6. Mention only real responsibilities from the resume.

7. Finish naturally.

End with:

"Yeah, that's all about myself. Thank you."

Keep the introduction around 180-220 words.

==================================================
RESPONSIBILITIES
==================================================

Every responsibility should start with an action verb.

Examples:

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

Return ONLY valid JSON.

Do NOT return markdown.

Do NOT return code fences.

Use exactly this structure:

{
  "candidateName": "",
  "experience": "",
  "currentCompany": "",
  "primaryRole": "",
  "primarySkills": [],
  "secondarySkills": [],
  "currentProjectName": "",
  "currentProjectDomain": "",
  "currentProjectSummary": "",
  "currentProjectResponsibilities": [],
  "previousProjectName": "",
  "previousProjectDomain": "",
  "previousProjectSummary": "",
  "previousProjectResponsibilities": [],
  "toolsAndTechnologies": [],
  "achievements": [],
  "candidateSummary": "",
  "selfIntroduction": ""
}
`;

    // -----------------------------------------
    // 5. Call OpenAI
    // -----------------------------------------
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
              type: "json_object",
            },
          },
        }),
      }
    );

    // -----------------------------------------
    // 6. Read OpenAI response
    // -----------------------------------------
    const data = await response.json();

    console.log(
      "========== RESUME OPENAI RESPONSE =========="
    );

    console.log(
      util.inspect(data, {
        depth: null,
        colors: true,
        maxArrayLength: null,
      })
    );

    console.log(
      "============================================"
    );

    // -----------------------------------------
    // 7. Handle OpenAI error
    // -----------------------------------------
    if (!response.ok) {
      console.error(
        "Resume Summary OpenAI Error:",
        data
      );

      return res.status(response.status).json({
        resumeProfile: null,
        error:
          data?.error?.message ||
          "OpenAI resume processing failed",
      });
    }

    // -----------------------------------------
    // 8. Get generated text
    // -----------------------------------------
    let text = data.output_text || "";

    // Fallback if output_text is unavailable
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

    text = String(text || "").trim();

    // -----------------------------------------
    // 9. Check empty response
    // -----------------------------------------
    if (!text) {
      console.error(
        "OpenAI returned empty resume profile"
      );

      return res.status(500).json({
        resumeProfile: null,
        error: "OpenAI returned empty response",
      });
    }

    console.log(
      "========== RESUME PROFILE =========="
    );

    console.log(text);

    console.log(
      "===================================="
    );

    // -----------------------------------------
    // 10. Convert JSON string to object
    // -----------------------------------------
    let resumeProfile;

    try {
      resumeProfile = JSON.parse(text);
    } catch (parseError) {
      console.error(
        "Resume JSON Parse Error:",
        parseError
      );

      console.error(
        "Invalid OpenAI Output:",
        text
      );

      return res.status(500).json({
        resumeProfile: null,
        error:
          "Invalid resume profile returned by OpenAI",
      });
    }

    // -----------------------------------------
    // 11. Send profile to frontend
    // -----------------------------------------
    return res.json({
      resumeProfile,
    });

  } catch (err) {
    console.error(
      "Resume Summary Error:",
      err
    );

    return res.status(500).json({
      resumeProfile: null,
      error: "Resume processing failed",
    });
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
    resumeProfile,
  } = req.body || {};

  const cleanQ = getCleanQuestion(question);

  if (!cleanQ.trim()) {
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

    // -----------------------------------------
    // Resume profile check
    // -----------------------------------------
    const profileText = resumeProfile
      ? JSON.stringify(resumeProfile, null, 2)
      : "Candidate profile not available.";

    // -----------------------------------------
    // SSE headers
    // -----------------------------------------
    res.status(200);
    res.setHeader(
      "Content-Type",
      "text/event-stream; charset=utf-8"
    );
    res.setHeader(
      "Cache-Control",
      "no-cache, no-transform"
    );
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    // -----------------------------------------
    // System prompt
    // -----------------------------------------
    const messages = [
      {
        role: "system",
        content: `
You are a senior interview coach helping a candidate in a live interview.

Answer exactly like an experienced Indian software engineer speaking to an interviewer.

Speak naturally and use simple Indian spoken English.

==================================================
CANDIDATE PROFILE
==================================================

The following profile was generated by GPT-5 after analyzing the uploaded resume.

Treat this profile as the ONLY source of truth about the candidate.

${profileText}

==================================================
IMPORTANT RULES
==================================================

Never invent:

- Companies
- Projects
- Responsibilities
- Technologies
- Achievements
- Experience
- Dates
- Numbers
- Production incidents

If the candidate profile does not show direct experience with a technology, do not pretend the candidate worked on it.

Instead say something like:

"I haven't worked directly on Kafka, but I understand how it works."

==================================================
FOLLOW-UP QUESTIONS
==================================================

Use the previous conversation history.

For follow-up questions:

- Continue naturally from the previous answer.
- Do not restart the topic.
- Do not repeat information already explained.
- Answer only the newly asked part.
- If asked "why", explain the reason.
- If asked "how", explain the implementation.
- If asked for an example, give one practical example.
- If asked for a comparison, compare only the requested concepts.

If the question is new, answer independently.

==================================================
ANSWER STYLE
==================================================

Always speak like a real Indian software engineer in an interview.

Use simple spoken English.

Be direct and interview-ready.

Follow the Markdown format generated by buildPrompt().
`,
      },
    ];

    // -----------------------------------------
    // Conversation history
    // -----------------------------------------
    safeHistory.slice(-6).forEach((turn) => {
      if (!turn || !turn.content) return;

      messages.push({
        role:
          turn.role === "assistant"
            ? "assistant"
            : "user",

        content: String(turn.content).slice(
          0,
          1800
        ),
      });
    });

    // -----------------------------------------
    // Current question
    // -----------------------------------------
    messages.push({
      role: "user",
      content: prompt,
    });

  // -----------------------------------------
  // Token limits based on question type
  // -----------------------------------------
  const maxTokensByType = {
    SELF_INTRO: 300,
    CODING: 650,
    SCENARIO: 500,
    ARCHITECTURE: 900,
    CONCEPT: 350,
  };

  const maxCompletionTokens =
    maxTokensByType[questionType] ||
    maxTokensByType.CONCEPT;

    // -----------------------------------------
    // OpenAI request
    // -----------------------------------------
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
          max_completion_tokens: maxCompletionTokens,
        }),
      }
    );

    // -----------------------------------------
    // OpenAI error
    // -----------------------------------------
    if (
      !openaiResponse.ok ||
      !openaiResponse.body
    ) {
      const errorText =
        await openaiResponse.text();

      console.error(
        "OpenAI Stream Error:",
        errorText
      );

      res.write(
        "Unable to generate answer right now. Please try again."
      );

      return res.end();
    }

    // -----------------------------------------
    // Process OpenAI streaming response
    // -----------------------------------------
    const processSsePart = (part) => {
      const lines = part
        .split("\n")
        .filter((line) =>
          line.startsWith("data:")
        );

      for (const line of lines) {
        const data = line
          .replace(/^data:\s*/, "")
          .trim();

        if (
          !data ||
          data === "[DONE]"
        ) {
          continue;
        }

        try {
          const event = JSON.parse(data);

          const delta =
            extractDeltaFromOpenAIEvent(event);

          if (delta) {
            res.write(delta);
            res.flush?.();
          }
        } catch (err) {
          console.error(
            "OpenAI stream parse error:",
            err
          );
        }
      }
    };

    // -----------------------------------------
    // Read streaming response
    // -----------------------------------------
    if (
      typeof openaiResponse.body
        .getReader === "function"
    ) {
      const reader =
        openaiResponse.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";

      while (true) {
        const {
          done,
          value,
        } = await reader.read();

        if (done) break;

        buffer += decoder.decode(
          value,
          { stream: true }
        );

        const parts =
          buffer.split("\n\n");

        buffer =
          parts.pop() || "";

        parts.forEach(
          processSsePart
        );
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        processSsePart(buffer);
      }

    } else if (
      typeof openaiResponse.body[
        Symbol.asyncIterator
      ] === "function"
    ) {
      const decoder =
        new TextDecoder();

      let buffer = "";

      for await (
        const chunk of openaiResponse.body
      ) {
        buffer += decoder.decode(
          chunk,
          { stream: true }
        );

        const parts =
          buffer.split("\n\n");

        buffer =
          parts.pop() || "";

        parts.forEach(
          processSsePart
        );
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        processSsePart(buffer);
      }
    }

    res.end();

  } catch (err) {
    console.error(
      "Answer Stream Error:",
      err
    );

    if (!res.headersSent) {
      res.status(500).send(
        "Server Error while generating answer"
      );
    } else {
      res.write(
        "\n\nServer Error while generating answer."
      );

      res.end();
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
