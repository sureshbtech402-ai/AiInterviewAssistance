
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

    if (!resumeText) {
      return res.status(400).json({ resumeProfile: null });
    }

    const prompt = `
You are a resume extraction and interview preparation assistant.

Extract only facts explicitly present in the resume. Do not guess or invent company names, experience, projects, tools, metrics, responsibilities, or achievements. Keep missing values empty.

Resume Content:
${resumeText}

Create one recommended self-introduction in simple, natural Indian spoken English. It should sound like the candidate is speaking directly in an interview.

SELF-INTRODUCTION STYLE:
- Start naturally with: "Hi, I am [Name]."
- Mention total experience, primary role, and current company only when present.
- Mention the strongest relevant technologies from the resume without making the list too long.
- Briefly mention the current or major project, domain, and core responsibilities when present.
- End naturally with interest in learning, solving technical problems, and professional growth.
- Keep it between 100 and 130 words.
- Do not use difficult corporate words.
- Do not begin sentences with "So", "Basically", "Actually", or "Mainly".

For rolesAndResponsibilities, each point must start with a clear action verb such as Developed, Implemented, Integrated, Fixed, Deployed, or Tested.

Return exactly one valid JSON object using this schema:
{
  "candidateSummary": "Brief factual professional summary",
  "experience": "Total experience exactly as found",
  "primarySkills": ["Core skills"],
  "secondarySkills": ["Supporting skills"],
  "currentProjectName": "Current or major project name",
  "previousProjectName": "Previous project name if available",
  "projectDomain": "Project domain",
  "projectSummary": "Brief factual project overview",
  "rolesAndResponsibilities": ["Action-oriented responsibility"],
  "toolsAndTechnologies": ["Tools and technologies"],
  "achievements": ["Only explicit achievements"],
  "selfIntroduction": "One recommended natural interview-ready introduction",
  "projectExplanation": "Natural 3 to 5 sentence spoken project explanation",
  "rolesExplanation": "Natural spoken explanation of the candidate's core responsibilities"
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
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_completion_tokens: 1200
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

function getCleanQuestion(question) {
  if (!question) return "";
  if (typeof question === "string") return question;
  if (typeof question === "object") {
    return question.question || question.text || question.transcript || JSON.stringify(question);
  }
  return String(question);
}

function isSpecialQuestion(question = "") {
  const q = getCleanQuestion(question).toLowerCase().trim();
  if (!q) return false;

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

function isCodingQuestion(question) {
  const q = getCleanQuestion(question).toLowerCase().trim();
  if (!q) return false;

  const strongCodingPatterns = [
    /\bwrite (a|an|the)?\s*(java|python|javascript|sql)?\s*(program|code|function|method|query)\b/,
    /\bwrite code\b/,
    /\bwrite a program\b/,
    /\bimplement (a|an|the)?\b/,
    /\bsolve (this|the) coding\b/,
    /\bfind (the )?(second highest|duplicate|duplicates|unique|largest|smallest)\b/,
    /\breverse (a|the)?\s*(string|number|array)\b/,
    /\bremove duplicates\b/,
    /\bsort (a|the)?\s*(array|list|string)\b/,
    /\busing streams?\b/,
    /\bsql query\b/
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
    /\bmicroservice failure\b/
  ];

  return scenarioPatterns.some((pattern) => pattern.test(q));
}

function buildSpecialPrompt({ question, resumeText }) {
  const cleanQ = getCleanQuestion(question);

  return `You are helping a candidate answer a live interview question.

Resume context:
${resumeText || "Resume details are not available"}

Question:
${cleanQ}

RULES:
- Answer in first person, as if the candidate is speaking directly to the interviewer.
- Use simple, natural Indian spoken English.
- Use only facts available in the resume context.
- Never invent companies, experience, projects, technologies, or responsibilities.
- Use short, easy-to-speak sentences.
- Sound confident, friendly, and professional.
- Do not use difficult corporate words.
- Do not start with "So", "Basically", "Actually", or "Mainly".

If the question is about self-introduction:
- Return only the heading "## 🎯 Self Introduction" followed by one recommended introduction.
- Follow this natural flow: name, experience and role, current company, core technologies, project and responsibilities, learning interest, and career goal.
- Keep it between 100 and 130 words.

If the question is about project, architecture, daily activities, or responsibilities:
- Return "## 🎯 Interview Answer" with a natural spoken explanation.
- Add "## 📌 Key Responsibilities" only when useful, with maximum 3 short points.
- Keep the complete response between 100 and 170 words.`;
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
- Use Java Streams only when the question asks for streams.
- Avoid advanced logic unless required.
- Use simple variable names.
- Include required imports and a main method when needed.
- Keep comments minimal.
- Do not provide multiple solutions unless requested.

Return only this format:

## 💻 Simple Code
\`\`\`java
[Complete working code]
\`\`\`

## 🎤 How to Explain
[Explain the logic naturally in 3 to 4 short sentences. Mention time complexity only when useful.]`;
}

function buildScenarioPrompt({ question, resumeText }) {
  const cleanQ = getCleanQuestion(question);

  return `You are helping a Java Backend Developer answer a scenario-based live interview question.

Candidate Resume Summary:
${resumeText || "Resume summary is not available"}

Interview Question:
${cleanQ}

TASK:
Understand the scenario, find the closest matching experience in the resume, and create a meaningful answer the candidate can speak directly.

RULES:
- Use simple, natural Indian spoken English.
- Use "I", "my team", and "in my project" naturally.
- Use only facts available in the resume.
- Never invent incidents, tools, numbers, achievements, client names, or results.
- When the resume supports the scenario, connect it naturally with the relevant project, responsibility, and technology.
- When the exact scenario is not present, clearly say: "I have not faced the exact same situation, but based on my project experience, I would handle it in this way."
- Explain the situation, responsibility, technical actions, result or expected outcome, and prevention or learning.
- Do not label the response as STAR unless the question asks for STAR format.
- Do not start with "So", "Basically", "Actually", or "Mainly".
- Keep it between 120 and 180 words.

Return exactly:

## 🎯 Scenario Answer
[Natural spoken interview answer]

## 📌 Key Actions
- [Maximum 3 short technical actions]`;
}

function buildConceptPrompt({ question, resumeText }) {
  const cleanQ = getCleanQuestion(question);

  return `You are helping a Java Backend Developer answer a live technical interview question.

Candidate context:
${resumeText || "Java Backend Developer with Spring Boot and Microservices experience"}

Interview question:
${cleanQ}

SPEAKING STYLE:
- Answer exactly as the candidate can speak directly to the interviewer.
- Use simple and natural Indian spoken English.
- Start directly with the definition or main answer.
- Use natural phrases such as "It is used to", "For example", "The main difference is", and "In my project" only when suitable.
- Use "I" naturally for genuine project experience.
- Do not use difficult or exaggerated corporate words.
- Do not start with "So", "Basically", "Actually", or "Mainly".
- Do not invent project usage. Mention the project only when the resume supports it.

ANSWER LENGTH:
- Small concept, annotation, keyword, or difference: 60 to 100 words.
- Project or practical explanation: 100 to 150 words.
- Architecture or end-to-end flow: maximum 220 words.
- Do not repeat the same information.

Return exactly:

## 🎯 Interview Answer
[Direct natural spoken answer]

## 📌 Quick Points
- [Maximum 3 short points]`;
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
    
    // Choose the isolated prompt context based on input characteristics
    if (isSpecialQuestion(cleanQ)) {
      prompt = buildSpecialPrompt({
        question: cleanQ,
        resumeText,
      });
    } else if (isCodingQuestion(cleanQ)) {
      prompt = buildCodingPrompt({
        question: cleanQ,
      });
    } else if (isScenarioQuestion(cleanQ)) {
      prompt = buildScenarioPrompt({
        question: cleanQ,
        resumeText,
      });
    } else {
      prompt = buildConceptPrompt({
        question: cleanQ,
        resumeText,
      });
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
Keep answers concise and meaningful.
Use only resume-supported facts for project claims.
For coding questions, provide the simplest working code.`
    });

    if (Array.isArray(history) && history.length > 0) {
      const recentHistory = history.slice(-4);

      recentHistory.forEach((turn) => {
        messages.push({
          role: turn.role === "assistant" ? "assistant" : "user",
          content: String(turn.content || "").slice(0, 1500),
        });
      });
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
        temperature: 0.35,
        max_completion_tokens: isCodingQuestion(cleanQ) ? 500 : 350
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
