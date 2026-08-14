
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
    // 2. Check resume
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

    fs.unlinkSync(pdfPath);

    const pdfBase64 = pdfBuffer.toString("base64");

    // -----------------------------------------
    // 4. Resume analysis prompt
    // -----------------------------------------
    const prompt = `
You are a resume extraction assistant for a LIVE technical
interview assistant.

Read the uploaded resume carefully before generating the profile.

Your job is to extract factual information from the resume and
prepare a concise candidate profile that will later be used to
answer interview questions.

==================================================
STRICT FACTUAL RULES
==================================================

Use ONLY information explicitly present in the resume.

Never guess.

Never invent.

Never assume.

Never add information because it is common for that role.

Never invent:

- Companies
- Projects
- Clients
- Technologies
- Tools
- Responsibilities
- Experience
- Dates
- Numbers
- Achievements
- Domains
- Production incidents

If information is not available in the resume:

Use "" for text fields.

Use [] for array fields.

==================================================
CANDIDATE ROLE
==================================================

Identify the candidate's actual technical role based on the
resume.

Consider:

- Skills
- Technologies
- Projects
- Responsibilities
- Experience

Do not blindly copy an HR designation.

Examples:

Selenium + Java + TestNG + Automation
=> Automation Test Engineer

Selenium + REST Assured + Cucumber + API Testing
=> QA Automation Engineer

Java + Spring Boot + REST APIs + Microservices
=> Java Backend Developer

React + Angular
=> Frontend Developer

React + Spring Boot
=> Full Stack Developer

AWS + Docker + Kubernetes + CI/CD
=> DevOps Engineer

Choose the role that best represents the candidate's actual
technical work.

==================================================
SKILLS
==================================================

primarySkills:

Include the strongest technical skills that represent the
candidate's main profile.

secondarySkills:

Include supporting tools, technologies and testing skills.

Do not invent skills.

Do not duplicate the same skill unnecessarily.

==================================================
CURRENT PROJECT
==================================================

Extract the current or most recent project from the resume.

Only include information explicitly supported by the resume.

For the project summary:

Explain briefly what the resume actually says about the project.

If the resume does NOT explain what the application does,
do NOT guess.

For example, if the resume only says:

"Travel booking modules"

then use something like:

"Worked on automation and testing of travel booking modules."

Do NOT invent:

"The application allows users to search, book and manage travel
services."

==================================================
PROJECT RESPONSIBILITIES
==================================================

Extract only responsibilities explicitly supported by the resume.

Keep each responsibility short.

Whenever possible, begin with an action verb:

Developed
Implemented
Automated
Integrated
Configured
Maintained
Tested
Executed
Validated
Performed
Designed
Deployed
Fixed

Do not create responsibilities that are only implied by a skill.

==================================================
PREVIOUS EXPERIENCE
==================================================

Include previous project or experience only when explicitly
available in the resume.

If there is no clear previous project:

Use:

""

and

[]

Do not invent previous projects.

==================================================
ACHIEVEMENTS
==================================================

Include ONLY achievements explicitly written in the resume.

Keep exact numbers when the resume provides them.

For example:

"Reduced regression cycle by 40%."

Do not create achievements from responsibilities.

Do not estimate numbers.

==================================================
CANDIDATE SUMMARY
==================================================

Create a short factual professional summary using ONLY information
from the resume.

Do not use exaggerated phrases such as:

"Highly skilled"

"Expert"

"World-class"

"Extensive expertise"

Keep it factual and simple.

==================================================
SELF INTRODUCTION
==================================================

Generate ONE natural interview-ready self introduction.

The introduction must sound like the candidate is SPEAKING to
an interviewer.

It must NOT sound like a resume being read aloud.

Use simple natural Indian spoken English.

Use first person.

The introduction should naturally include, when available:

1. Name

2. Total experience

3. Current technical role and company

4. Main technical skills

5. Current project or current work

6. What the candidate actually works on

7. One relevant previous experience if useful

8. One important achievement if useful

Do NOT list every technology.

Select only the strongest and most relevant skills.

Do NOT explain technologies in detail.

Do NOT invent project functionality.

If the resume does not explain what the application does,
simply talk about the candidate's actual work.

==================================================
SELF INTRODUCTION STYLE
==================================================

Use natural spoken sentences.

Good:

"Hi, I'm Gangaraju. I have around 6 years of experience in
QA automation, mainly working with Selenium, Java, REST Assured
and Cucumber."

Good:

"Currently, I'm working with Xola Travels, where I mainly work
on automation and testing of travel booking modules."

Good:

"My work involves BDD and Cucumber automation, API testing,
regression testing and CI/CD."

Avoid:

"I possess extensive knowledge..."

"I have profound expertise..."

"I am highly proficient..."

"Furthermore..."

"Moreover..."

"In conclusion..."

"According to my resume..."

"Based on my profile..."

"The candidate..."

Do not make the introduction sound memorized.

Do not use bullet points.

Do not use headings.

Do not use markdown.

Do not use emojis.

Keep it around 120-170 words.

Do not force the word count.

If the resume has limited information, keep it shorter.

End naturally.

For example:

"That's a brief introduction about me. Thank you."

==================================================
IMPORTANT SELF INTRODUCTION RULE
==================================================

The self introduction MUST be based on the extracted facts.

Do not add information that is not present in the resume.

Do not assume:

- Application functionality
- Client details
- Team size
- Architecture
- Responsibilities
- Tools
- Business impact

unless explicitly available in the resume.

==================================================
OUTPUT
==================================================

Return ONLY ONE valid JSON object.

Do NOT return markdown.

Do NOT return code fences.

Do NOT add explanations before or after the JSON.

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
    // 7. OpenAI error
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
    // 8. Extract generated JSON
    // -----------------------------------------
    let text = data.output_text || "";

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
    // 9. Empty response
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
    // 10. Parse JSON
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

  if (!cleanQ || !cleanQ.trim()) {
    return res.status(400).send("Question is empty");
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).send("OPENAI_API_KEY is missing");
  }

  try {
    const safeHistory = Array.isArray(history)
      ? history
      : [];

    const questionType = classifyQuestion(cleanQ);

    // -----------------------------------------
    // Build question-specific prompt
    // -----------------------------------------
    const prompt = buildPrompt({
      question: cleanQ,
      history: safeHistory,
      interviewLevel,
      company,
      interviewType,
    });

    // -----------------------------------------
    // Candidate profile
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

    res.setHeader(
      "Connection",
      "keep-alive"
    );

    res.setHeader(
      "X-Accel-Buffering",
      "no"
    );

    res.flushHeaders?.();

    // -----------------------------------------
    // System prompt
    // -----------------------------------------
    const messages = [
      {
        role: "system",

        content: `
You are the CANDIDATE in a LIVE technical interview.

You are NOT an interview coach.
You are NOT a teacher.
You are NOT writing documentation.

Your response must be exactly what the candidate would naturally
say to the interviewer.

Company:
${company || "Not specified"}

Interview Level:
${interviewLevel || "Not specified"}

Interview Type:
${interviewType || "General"}

==================================================
CANDIDATE PROFILE
==================================================

The following profile was extracted from the candidate's resume.

Treat it as the ONLY source of truth for the candidate's
personal experience.

${profileText}

==================================================
STRICT EXPERIENCE RULES
==================================================

Never invent:

- Companies
- Projects
- Clients
- Responsibilities
- Technologies
- Tools
- Experience
- Dates
- Numbers
- Achievements
- Production incidents

If something is not present in the profile, do not claim the
candidate has worked on it.

If asked about a technology that is not in the profile, explain
the technical concept honestly without pretending the candidate
has practical experience.

For example:

"I haven't worked directly on Kafka, but I understand the concept.
Basically, Kafka is used for..."

==================================================
HOW THE ANSWER MUST SOUND
==================================================

Speak like a real experienced Indian software engineer / QA
Automation Engineer speaking in an interview.

The answer must sound SPOKEN.

Use:

- Simple English
- Natural Indian spoken English
- Short sentences
- Conversational wording
- First person when discussing experience
- Practical technical language

Use natural phrases when appropriate:

"Basically..."
"In my project..."
"I usually..."
"The main point is..."
"In Selenium, I..."
"For example..."
"In my automation work..."
"We used..."
"I handled..."
"I implemented..."

Do not force these phrases.

==================================================
VERY IMPORTANT
==================================================

DO NOT write like documentation.

DO NOT write like a textbook.

DO NOT teach the interviewer.

DO NOT give a tutorial.

DO NOT explain everything you know.

DO NOT make the answer unnecessarily detailed.

Answer ONLY what the interviewer asked.

==================================================
NEVER USE
==================================================

Do not use:

- Headings
- Section titles
- Markdown explanations
- Emojis
- "Certainly"
- "Sure"
- "Let me explain"
- "Let me elaborate"
- "According to my resume"
- "Based on my profile"
- "According to my experience"
- "Furthermore"
- "Moreover"
- "Additionally"
- "In conclusion"

Do not say:

"The candidate..."

Speak as the candidate.

==================================================
ANSWER LENGTH
==================================================

Keep answers short and natural.

Simple concept:
2-4 spoken sentences.

Normal technical question:
3-6 spoken sentences.

Project question:
4-7 spoken sentences.

Follow-up:
Answer ONLY the new point.

Coding:
Give the required code first and only a short explanation.

Architecture:
Explain the relevant flow, but do not create unnecessary
sections.

Scenario:
Give a practical answer based on the candidate's experience
when available.

STOP once the interviewer has enough information.

==================================================
TECHNICAL DOMAIN
==================================================

When the question belongs to a specific technology, answer using
that technology.

For Selenium questions:
Prefer Selenium with Java when appropriate.

For API automation:
Prefer REST Assured with Java when appropriate.

For BDD:
Use Cucumber and BDD terminology.

For TestNG:
Use TestNG terminology.

For API testing:
Use Postman / REST Assured when relevant.

For Java:
Answer from a Core Java interview perspective.

For SQL:
Give the correct SQL query when requested.

Do not force these technologies into unrelated questions.

==================================================
FOLLOW-UP QUESTIONS
==================================================

Use the previous conversation to understand context.

If the interviewer asks:

"Why?"

Answer only why.

"How?"

Answer only how.

"Then?"

Continue naturally from the previous answer.

"What about Selenium?"

Continue the same discussion using Selenium.

"Can you give syntax?"

Give the actual syntax.

"Can you write code?"

Give the actual code.

"Why did you use HashMap?"

Explain only why HashMap was used.

Do NOT repeat the complete previous answer.

==================================================
PROJECT QUESTIONS
==================================================

When the interviewer asks about the candidate's project:

Use ONLY the Candidate Profile.

Speak naturally in first person.

For example:

"In my current project, I mainly work on..."

"I handle automation using Selenium and Java..."

"We use Cucumber for BDD..."

Do not invent application functionality that is not in the
Candidate Profile.

==================================================
FINAL RULE
==================================================

The interviewer should feel like a real candidate is answering
immediately.

The answer should be:

Natural.
Short.
Technical.
Confident.
Easy to speak.

Return ONLY the answer the candidate should say or write.

Start immediately.
`,
      },
    ];

    // -----------------------------------------
    // Recent conversation history
    // -----------------------------------------
    safeHistory
      .slice(-6)
      .forEach((turn) => {
        if (!turn || !turn.content) {
          return;
        }

        messages.push({
          role:
            turn.role === "assistant"
              ? "assistant"
              : "user",

          content: String(turn.content).slice(
            0,
            1500
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
    // Token limits
    // -----------------------------------------
    const maxTokensByType = {
      SELF_INTRO: 280,
      CODING: 650,
      SCENARIO: 450,
      ARCHITECTURE: 700,
      CONCEPT: 300,
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
          Authorization:
            `Bearer ${process.env.OPENAI_API_KEY}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          model: ANSWER_MODEL,

          messages,

          stream: true,

          temperature: 0.2,

          max_completion_tokens:
            maxCompletionTokens,
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
    // Process SSE
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
    // Read stream
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

        if (done) {
          break;
        }

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
