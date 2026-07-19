
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
       "I am [Candidate Name], I have around [Years] years of experience as a [Primary Role, e.g., Java Backend Developer] and currently work at [Current Company Name, e.g., Tata Consultancy Services]. I have Experience in [Core Tech Stack list, e.g., Java, Spring Boot, Microservices, Hibernate, SQL, REST APIs, Kafka, Docker, Kubernetes, Git, and Maven]. Currently, I am working on the [Project Name, e.g., ING Digitization] project for a [Domain, e.g., banking] client, where I [Core Responsibilities, e.g., develop REST APIs, implement business logic, and work with Spring Data JPA and microservices]. I enjoy learning new technologies and solving technical problems. I am looking for an opportunity where I can contribute, learn, and grow professionally."
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
      "currentProjectName": "Major project name",
      "previousProjectName": "previous project name",
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
   "I am Suresh Chinnamadula, I have around 4 years of experience as a Java Backend Developer and I am currently working in TCS. I have experience in Java, Spring Boot, Microservices, Hibernate, SQL, REST APIs, Apache Kafka, Docker, Kubernetes, Git, and Maven. Currently, I am working on the ING Digitization project for a banking client, where I develop REST APIs, implement business logic, and work with Spring Data JPA and microservices. I enjoy learning new technologies and solving technical problems. I am looking for an opportunity where I can contribute, learn, and grow professionally."
   Make sure it matches this structure exactly, naturally filling in the brackets with actual facts from the provided Resume Context.
2. BAN WEAK FILLERS: Absolutely never use words like "So,", "Basically,", "Mainly,", "Actually,", "Like,", or "As such,".
3. TECHNICAL ACTION BULLETS: In the "Roles and Responsibilities" section, create exactly 3 high-impact bullet points demonstrating technical ownership. Every single bullet point MUST begin directly with a strong, active technical verb (e.g., "Implemented...", "Developed...", "Architected...", "Optimized...").
4. STRICT NO PRONOUNS RULE FOR BULLETS: Absolutely never start bullet points with personal pronouns or conversational descriptors (do NOT start with "I...", "We...", "My...", "Mainly...", "Also...", "Additionally..."). Start directly with the technical verb!

Return exactly this Markdown structure and nothing else:

## 🎯 Self Introduction
[Insert the highly natural, specific, conversational indian spoken response here]

## ⭐ Roles and Responsibilities
- [Active Technical Verb with conversational indian spoken response here]...
- [Active Technical Verb with conversational indian spoken response here]...
- [Active Technical Verb with conversational indian spoken response here]...
- [Active Technical Verb with conversational indian spoken response here]...
- [Active Technical Verb with conversational indian spoken response here]...
- [Active Technical Verb with conversational indian spoken response here]...`;
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
1. Provide ONLY the complete, working, Simple logic, and well-commented code block under the "## 💻 Code" section.
2. Provide the 4-5 sentence spoken-ready explanation of how the code is Written under "### How the Code is Written".
3. Do NOT include any "Best Interview Ready Answer", "Real-Time Use", "Project Related Answer", or other conceptual headings. Keep it completely isolated to code.

Return exactly this Markdown structure:

## 💻 Code
[Provide the complete working Simple logic code block here in their primary language]

### How the Code is Written
[Provide 4-5 sentence explanation of how the logic is Written, approach, and how it executes in a clear, natural, and conversational indian spoken tone]`;
}

function buildConceptPrompt({
  question,
  resumeText,
  interviewLevel,
  interviewType,
  company,
}) {
  const cleanQ = getCleanQuestion(question);
  return `You are a professional technical interview simulator. Deliver a highly structured, direct technical response for a conceptual technical question.

Resume Profile Context:
${resumeText || "Resume profile not available"}
Target Company Context: ${company || "Target Company"}
Target Level: ${interviewLevel || "Mid Level"}
Target Type: ${interviewType || "Technical"}

Question: ${cleanQ}

  INSTRUCTIONS FOR "BEST INTERVIEW READY ANSWER" (🎯 Best Interview Ready Answer):

  - Provide Indian spoken interview-ready explanations.
  - Detect whether the interview question is:
    1. Small Technical Concept
    2. Architecture / Design Pattern / System Design / End-to-End Flow
    3. Project Experience

  - If the question is a Small Technical Concept (annotations, keywords, exceptions, collections, Spring concepts, APIs, Hibernate, etc.):
    - Start directly with the main definition of the core concept.
    - If the question is about a specific annotation, keyword, framework, or concept (like @SpringBootApplication), start with:
      👉 "[Concept] is..."
    - Immediately explain each important sub-component using simple bullet points.
    - Keep the explanation within 100-120 words.
    - Make it conversational and easy to speak in an interview.

  - If the question is about an Architecture, Design Pattern, System Design, Authentication Flow, Communication Flow, Deployment Flow, or any broad technical topic, DO NOT limit the answer to 100-120 words.

    Instead explain in this order:

    👉 Definition
    👉 Main Components
    👉 Step-by-Step Working Flow
    👉 Advantages
    👉 Real-Time Example
    👉 Project Usage (if applicable)

  - For architecture questions, explain each component briefly instead of only listing names.

  - Keep architecture answers around 250-400 words depending on the complexity of the topic.

  - Use simple Indian spoken English suitable for interviews.

  - Start directly with the explanation. Never give unnecessary introductions.

  - BAN WEAK FILLERS:
    Do NOT start sentences with:
    "So,"
    "Basically,"
    "Actually,"
    "Mainly,"

  - Highlight important technical keywords using **bold** formatting.

  ------------------------------------------------------------

  INSTRUCTIONS FOR KEY TAKEAWAYS (⭐ Real-Time Use)

  - Provide Indian spoken interview-ready explanations.
  - Provide 3-4 high-impact technical bullet points.
  - Highlight important technical keywords in **bold**.
  - Every bullet must start with a strong action verb.

  Examples:
  - Designed...
  - Leveraged...
  - Optimized...
  - Implemented...
  - Configured...
  - Integrated...
  - Secured...
  - Deployed...

  Do NOT start with:
  - I
  - We
  - My
  - Also
  - Additionally

  ------------------------------------------------------------

  INSTRUCTIONS FOR PROJECT LINK (📄 Project Related Answer)

  - Provide Indian spoken interview-ready explanations.
  - Connect the concept directly with my resume whenever possible.
  - If the concept was used in my project, explain how it was used in ING Digitization using Spring Boot, Microservices, WebClient, JPA, Docker, Kubernetes, REST APIs, or related technologies.
  - Keep it conversational in 3-4 lines.

  ------------------------------------------------------------

  Return exactly this Markdown structure:

  ## 🎯 Best Interview Ready Answer
  [Provide the answer based on the detected question type.]

  ## ⭐ Real-Time Use
  - ...
  - ...
  - ...
  - ...

  ## 📄 Project Related Answer
  [Provide a short conversational project-related explanation whenever applicable.]`;
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
        company,
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
      content: "You are an elite technical interview simulator. Ground all your responses strictly in the facts provided in the resume context."
    });

    if (Array.isArray(history) && history.length > 0) {
      history.forEach((turn) => {
        messages.push({
          role: turn.role === "assistant" ? "assistant" : "user",
          content: turn.content,
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
