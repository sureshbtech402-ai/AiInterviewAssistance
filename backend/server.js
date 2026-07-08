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
    You are an elite resume extraction and interview preparation engine.

    First, extract ONLY facts explicitly present in the resume.
    Do NOT guess, infer, or invent details (no fake company names, years, projects, or metrics).
    If any value is missing, keep it empty.

    Second, when writing the conversational fields ("selfIntroduction", "projectExplanation", "rolesExplanation"), you must adhere to these CRITICAL SPOKEN TONE RULES:
    1. EXTREMELY NATURAL SPOKEN FLOW: Formulate the "selfIntroduction" field to match this exact template structure based strictly on the candidate's real resume details:
       "Thank you for giving me this opportunity to introduce myself. My name is [Candidate Name], and I am from [Location/Native Place if in resume]. I have around [Years] years of experience as a [Primary Role, e.g., Java Backend Developer] and currently work at [Current Company Name, e.g., Tata Consultancy Services]. My technical skills include [Core Tech Stack list, e.g., Java, Spring Boot, Microservices, Hibernate, SQL, REST APIs, Kafka, Docker, Kubernetes, Git, and Maven]. Currently, I am working on the [Project Name, e.g., ING Digitization] project for a [Domain, e.g., banking] client, where I [Core Responsibilities, e.g., develop REST APIs, implement business logic, and work with Spring Data JPA and microservices]. I enjoy learning new technologies and solving technical problems. I am looking for an opportunity where I can contribute, learn, and grow professionally. Thank you."
       If any of these details (like Location or Company Name) are not present in the resume, omit those specific statements naturally without leaving blank templates.
    2. BAN WEAK FILLERS: Do NOT start any sentence or bullet point with words like "So,", "Basically,", "Mainly,", "Actually,", "Like,", or "As such,".
    3. ACTION VERB MANDATE: For roles and responsibilities, every single point must begin directly with a strong, active technical verb (e.g., "Implemented...", "Developed...", "Architected...", "Optimized..."). No pronouns like "I" or "We" inside bullet points.

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
      "selfIntroduction": "A highly natural, professional spoken self-introduction matching the exact requested flow. Clear, smooth, and welcoming. Do not use robotic or forced high-falutin openers.",
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
        model: "gpt-4o-mini",
        response_format: { type: "json_object" }, 
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.0, // Strict, deterministic extraction
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
  const cleanQ = getCleanQuestion(question).toLowerCase().trim();
  if (!cleanQ) return false;

  const codingKeywords = [
    "code", "program", "write a", "implement", "coding", "function", "snippet", 
    "algorithm", "query", "sql", "database schema", "class", "method", "compile", 
    "regex", "syntax"
  ];
  return codingKeywords.some(keyword => cleanQ.includes(keyword));
}

function buildSpecialPrompt({
  question,
  resumeText,
  interviewLevel,
  interviewType,
}) {
  const cleanQ = getCleanQuestion(question);
  return `You are an elite corporate technical coach. Translate the candidate's resume details into an exceptionally natural, warm, and highly polished spoken self-introduction.

Resume Profile Context:
${resumeText || "Resume profile not available"}

Interview Parameters: Level: ${interviewLevel || "Mid Level"}, Type: ${interviewType || "Technical"}
Question: ${cleanQ}

CRITICAL RULES FOR THE SELF-INTRODUCTION:
1. EXTREMELY NATURAL FLOW (MATCH THIS EXACT STYLE): 
   "Thank you for giving me this opportunity to introduce myself. My name is [Candidate Name], and I am from [Location]. I have around [X] years of experience as a [Primary Title, e.g. Java Backend Developer] and currently work at [Current Company Name]. My technical skills include [Primary skills, e.g. Java, Spring Boot, Microservices, Hibernate, SQL, REST APIs, Kafka, Docker, Kubernetes, Git, and Maven]. Currently, I am working on the [Project Name] project for a [Domain] client, where I develop [Responsibilities]. I enjoy learning new technologies and solving technical problems. I am looking for an opportunity where I can contribute, learn, and grow professionally. Thank you."
   Make sure it matches this structure exactly, naturally filling in the brackets with actual facts from the provided Resume Context.
2. BAN WEAK FILLERS: Absolutely never use words like "So,", "Basically,", "Mainly,", "Actually,", "Like,", or "As such,".
3. TECHNICAL ACTION BULLETS: In the "Roles and Responsibilities" section, create exactly 3 high-impact bullet points demonstrating technical ownership. Every single bullet point MUST begin directly with a strong, active technical verb (e.g., "Implemented...", "Developed...", "Architected...", "Optimized...").
4. STRICT NO PRONOUNS RULE FOR BULLETS: Absolutely never start bullet points with personal pronouns or conversational descriptors (do NOT start with "I...", "We...", "My...", "Mainly...", "Also...", "Additionally..."). Start directly with the technical verb!

Return exactly this Markdown structure and nothing else:

## 🎯 Self Introduction
[Insert the highly natural, specific, conversational spoken response here]

## ⭐ Roles and Responsibilities
- [Active Technical Verb]...
- [Active Technical Verb]...
- [Active Technical Verb]...`;
}

function buildCodingPrompt({
  question,
  resumeText,
}) {
  const cleanQ = getCleanQuestion(question);
  return `You are an elite coding interviewer. 
Analyze the candidate's primary technical stack from the Resume Context below.

Resume Context:
${resumeText || "Resume profile not available"}

CRITICAL CODING LANGUAGE RULE:
1. Identify the candidate's primary programming/backend language from their resume skills (e.g., Java, SQL, JavaScript, C++, Python).
2. You MUST write the complete code solution ONLY in their primary language. 
   - For example, if they are a Java Backend Developer, write the solution in Java.
   - If it is a database or query question, write it in SQL.
   - Do NOT write Python code if their resume specifies Java. Do NOT write JavaScript/Node.js if they are a C++ developer.
   - Only deviate if the question explicitly asks for a specific programming language (e.g., "Write this in Python").

Question: ${cleanQ}

INSTRUCTIONS:
1. Provide ONLY the complete, working, and well-commented code block under the "## 💻 Code" section.
2. Provide the complexity analysis and a 2-3 sentence spoken-ready explanation of how the code is structured under "## ⏱ Complexity & Explanation".
3. Do NOT include any "Interview Ready Answer", "Key Points", "Project Related Answer", or other conceptual headings. Keep it completely isolated to code.

Return exactly this Markdown structure:

## 💻 Code
[Provide the complete working code block here in their primary language]

## ⏱ Complexity & Explanation
- **Time Complexity:** O(...)
- **Space Complexity:** O(...)

### How the Code is Written
[Concise 2-3 sentence explanation of the logic, approach, and how it executes optimal data management]`;
}

function buildConceptPrompt({
  question,
  resumeText,
  interviewLevel,
  interviewType,
}) {
  const cleanQ = getCleanQuestion(question);
  return `You are a professional technical interview simulator. Deliver a highly structured, direct technical response for a conceptual technical question.

Resume Profile Context:
${resumeText || "Resume profile not available"}

Question: ${cleanQ}

INSTRUCTIONS FOR "INTERVIEW READY ANSWER" (🎯 Interview Ready Answer):
- Start directly with the main answer in a highly polished, natural spoken conversational format.
- If the question asks about a specific annotation, keyword, framework, or concept (like @SpringBootApplication), start with a direct definition highlighted with an emoji (e.g., 👉 "@SpringBootApplication is...").
- If the concept consists of multiple components or sub-parts (e.g., @Configuration, @EnableAutoConfiguration, @ComponentScan), list those components directly and explain each of them simply, clearly, and concisely in bullet points.
- Ensure the total explanation is extremely direct, punchy, conversational, and finishes within 100-120 words.
- BAN WEAK FILLERS: Do NOT start sentences or clauses with "So,", "Basically,", "Mainly,", or "Actually,".

INSTRUCTIONS FOR KEY TAKEAWAYS (⭐ Key Points):
- Provide 2-3 high-impact technical bullet points.
- Every bullet point MUST start directly with a strong, active technical verb (e.g., "Leveraged...", "Designed...", "Decoupled...", "Optimized..."). STRICTLY BAN starting with pronouns like "I", "We", "My", "Also", or "Additionally".

INSTRUCTIONS FOR PROJECT LINK (📄 Project Related Answer):
- Provide a brief 2-3 line conversational application tying this technical concept directly to a technology or responsibility listed in the resume (e.g., ING Digitization, Spring Boot).

Return exactly this Markdown structure:

## 🎯 Interview Ready Answer
[Your direct definition starting with a 👉 emoji, followed by simple bullet points breaking down each sub-annotation/concept component if applicable]

## ⭐ Key Points
- [Strong Active Verb]...
- [Strong Active Verb]...

## 📄 Project Related Answer
[Provide a short 2-3 line conversational application tying this concept directly to a technology or responsibility listed in the resume]`;
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
    let prompt = "";
    
    // Choose the isolated prompt context based on input characteristics
    if (isSpecialQuestion(cleanQ)) {
      prompt = buildSpecialPrompt({
        question: cleanQ,
        resumeText,
        interviewLevel,
        interviewType,
      });
    } else if (isCodingQuestion(cleanQ)) {
      prompt = buildCodingPrompt({
        question: cleanQ,
        resumeText,
      });
    } else {
      prompt = buildConceptPrompt({
        question: cleanQ,
        resumeText,
        interviewLevel,
        interviewType,
      });
    }

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
        temperature: 0.7, // Adds natural variation for natural-sounding speech delivery
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