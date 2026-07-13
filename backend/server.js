import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import {
  createClient,
  LiveTranscriptionEvents,
} from "@deepgram/sdk";

import {
  buildInterviewPrompt,
  getCleanQuestion,
} from "./promptBuilder.js";

const app = express();
const server = http.createServer(app);
const upload = multer({ dest: "uploads/" });

const PORT = process.env.PORT || 5000;

const OPENAI_MODEL =
  process.env.OPENAI_MODEL || "gpt-4o-mini";

const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN || "*";

const allowedOrigins =
  ALLOWED_ORIGIN === "*"
    ? true
    : ALLOWED_ORIGIN
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
  cors({
    origin: allowedOrigins,
    credentials: false,
  })
);

app.use(
  express.json({
    limit: "10mb",
  })
);

/* =====================================================
   DEEPGRAM CLIENT
===================================================== */

const deepgram = createClient(
  process.env.DEEPGRAM_API_KEY
);

/* =====================================================
   HEALTH ROUTES
===================================================== */

app.get("/", (req, res) => {
  res.send(
    "AI Interview Assistant Backend Running 🚀"
  );
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    deepgram: Boolean(
      process.env.DEEPGRAM_API_KEY
    ),
    openai: Boolean(
      process.env.OPENAI_API_KEY
    ),
    model: OPENAI_MODEL,
  });
});

/* =====================================================
   DEEPGRAM LIVE WEBSOCKET
===================================================== */

const wss = new WebSocketServer({
  server,
});

wss.on("connection", (client) => {
  console.log("React WebSocket Connected");

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error(
      "Missing DEEPGRAM_API_KEY"
    );

    if (
      client.readyState === WebSocket.OPEN
    ) {
      client.send(
        JSON.stringify({
          type: "error",
          error:
            "Missing DEEPGRAM_API_KEY",
        })
      );
    }

    client.close();
    return;
  }

  let deepgramReady = false;
  let closedByClient = false;

  const pendingAudio = [];

  const dgConnection =
    deepgram.listen.live({
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

  const sendToClient = (payload) => {
    if (
      client.readyState === WebSocket.OPEN
    ) {
      client.send(
        JSON.stringify(payload)
      );
    }
  };

  const keepAlive = setInterval(() => {
    try {
      if (
        deepgramReady &&
        typeof dgConnection.keepAlive ===
          "function"
      ) {
        dgConnection.keepAlive();
      }
    } catch (error) {
      console.error(
        "Deepgram keepAlive error:",
        error
      );
    }
  }, 5000);

  dgConnection.on(
    LiveTranscriptionEvents.Open,
    () => {
      console.log("Deepgram Connected");

      deepgramReady = true;

      sendToClient({
        type: "status",
        status: "deepgram_connected",
      });

      while (
        pendingAudio.length > 0
      ) {
        const chunk =
          pendingAudio.shift();

        try {
          dgConnection.send(chunk);
        } catch (error) {
          console.error(
            "Deepgram buffered send error:",
            error
          );
        }
      }
    }
  );

  client.on(
    "message",
    (audioChunk) => {
      if (
        !audioChunk ||
        audioChunk.length === 0
      ) {
        return;
      }

      try {
        if (
          deepgramReady &&
          dgConnection.getReadyState() ===
            1
        ) {
          dgConnection.send(audioChunk);
        } else {
          pendingAudio.push(
            audioChunk
          );

          if (
            pendingAudio.length > 50
          ) {
            pendingAudio.shift();
          }
        }
      } catch (error) {
        console.error(
          "Deepgram send error:",
          error
        );
      }
    }
  );

  dgConnection.on(
    LiveTranscriptionEvents.Transcript,
    (data) => {
      const transcript =
        data?.channel?.alternatives?.[0]
          ?.transcript || "";

      if (!transcript.trim()) {
        return;
      }

      const isFinal = Boolean(
        data?.is_final
      );

      const speechFinal = Boolean(
        data?.speech_final
      );

      console.log(
        `${
          isFinal
            ? "Final"
            : "Interim"
        } Transcript:`,
        transcript
      );

      sendToClient({
        type: "transcript",
        text: transcript,
        isFinal,
        speechFinal,
      });
    }
  );

  dgConnection.on(
    LiveTranscriptionEvents.Error,
    (error) => {
      console.error(
        "Deepgram Error:",
        error
      );

      sendToClient({
        type: "error",
        error:
          "Deepgram transcription error",
      });
    }
  );

  dgConnection.on(
    LiveTranscriptionEvents.Close,
    () => {
      console.log("Deepgram Closed");

      deepgramReady = false;

      clearInterval(keepAlive);

      if (
        !closedByClient &&
        client.readyState ===
          WebSocket.OPEN
      ) {
        sendToClient({
          type: "status",
          status: "deepgram_closed",
        });
      }
    }
  );

  client.on("close", () => {
    console.log(
      "React WebSocket Closed"
    );

    closedByClient = true;

    clearInterval(keepAlive);

    try {
      dgConnection.finish();
    } catch (error) {
      console.error(
        "Deepgram finish error:",
        error
      );
    }
  });

  client.on("error", (error) => {
    console.error(
      "React WebSocket Error:",
      error
    );
  });
});

/* =====================================================
   PRERECORDED TRANSCRIPTION FALLBACK
===================================================== */

app.post(
  "/transcribe",
  upload.single("audio"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            text:
              "No audio file received",
          });
      }

      if (
        !process.env
          .DEEPGRAM_API_KEY
      ) {
        return res
          .status(500)
          .json({
            text:
              "DEEPGRAM_API_KEY is missing",
          });
      }

      const audioBuffer =
        fs.readFileSync(
          req.file.path
        );

      const { result, error } =
        await deepgram.listen.prerecorded.transcribeFile(
          audioBuffer,
          {
            model: "nova-3",
            language: "en-US",
            punctuate: true,
            smart_format: true,
          }
        );

      if (error) {
        throw error;
      }

      const text =
        result?.results
          ?.channels?.[0]
          ?.alternatives?.[0]
          ?.transcript || "";

      res.json({
        text,
      });
    } catch (error) {
      console.error(
        "Transcription Error:",
        error
      );

      res.status(500).json({
        text:
          "Transcription Error",
      });
    } finally {
      if (
        req.file?.path &&
        fs.existsSync(
          req.file.path
        )
      ) {
        fs.unlinkSync(
          req.file.path
        );
      }
    }
  }
);

/* =====================================================
   RESUME SUMMARY
===================================================== */

app.post(
  "/resume-summary",
  async (req, res) => {
    try {
      const { resumeText } =
        req.body || {};

      if (
        !resumeText ||
        !resumeText.trim()
      ) {
        return res
          .status(400)
          .json({
            resumeProfile: null,
            error:
              "Resume text is empty",
          });
      }

      if (
        !process.env
          .OPENAI_API_KEY
      ) {
        return res
          .status(500)
          .json({
            resumeProfile: null,
            error:
              "OPENAI_API_KEY is missing",
          });
      }

      const resumePrompt = `
You are a strict resume fact-extraction engine.

Extract only information explicitly written in the resume.

Do not:
- invent facts
- infer missing experience
- calculate experience unless clearly stated
- invent company names
- invent project names
- invent clients
- invent technologies
- invent metrics
- invent achievements
- invent responsibilities

When information is unavailable, return an empty string or empty array.

Employment rules:
- Identify the current company using "Present", "Current", or the latest employment period.
- Keep the current company separately.
- Store every previous company separately.
- Keep employment history in reverse chronological order.
- Preserve exact company names, roles, and durations.
- If only one company is present, return an empty previousCompanies array.

Project rules:
- Store the current or most recent project as currentProjectName.
- Store all older projects in previousProjectNames.
- Never create project information that is not present.

Resume Content:
${resumeText}

Return only one valid JSON object with this exact structure:

{
  "candidateName": "",
  "location": "",
  "candidateSummary": "",
  "experience": "",
  "currentCompany": {
    "companyName": "",
    "designation": "",
    "duration": ""
  },
  "previousCompanies": [
    {
      "companyName": "",
      "designation": "",
      "duration": ""
    }
  ],
  "employmentHistory": [
    {
      "companyName": "",
      "designation": "",
      "duration": "",
      "isCurrent": false
    }
  ],
  "primarySkills": [],
  "secondarySkills": [],
  "currentProjectName": "",
  "previousProjectNames": [],
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

      const response = await fetch(
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
            model: OPENAI_MODEL,

            response_format: {
              type: "json_object",
            },

            messages: [
              {
                role: "system",

                content:
                  "Extract resume facts exactly. Never guess or invent missing information.",
              },

              {
                role: "user",
                content:
                  resumePrompt,
              },
            ],

            temperature: 0,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        console.error(
          "Resume Summary OpenAI Error:",
          data
        );

        return res
          .status(response.status)
          .json({
            resumeProfile: null,
            error:
              data?.error?.message ||
              "Resume extraction failed",
          });
      }

      const outputText =
        data?.choices?.[0]
          ?.message?.content
          ?.trim() || "";

      if (!outputText) {
        console.error(
          "Empty resume extraction response"
        );

        return res
          .status(500)
          .json({
            resumeProfile: null,
            error:
              "Resume extraction returned empty data",
          });
      }

      let resumeProfile;

      try {
        resumeProfile =
          JSON.parse(outputText);
      } catch (parseError) {
        console.error(
          "Resume JSON Parse Error:",
          parseError
        );

        console.error(
          "Raw Resume Output:",
          outputText
        );

        return res
          .status(500)
          .json({
            resumeProfile: null,
            error:
              "Unable to parse resume profile",
          });
      }

      console.log(
        "Resume profile created successfully"
      );

      res.json({
        resumeProfile,
      });
    } catch (error) {
      console.error(
        "Resume Summary Error:",
        error
      );

      res.status(500).json({
        resumeProfile: null,
        error:
          "Unable to create resume profile",
      });
    }
  }
);

/* =====================================================
   OPENAI STREAM HELPERS
===================================================== */

function extractDeltaFromOpenAIEvent(
  event
) {
  if (
    !event ||
    typeof event !== "object"
  ) {
    return "";
  }

  if (
    Array.isArray(
      event.choices
    ) &&
    event.choices[0]?.delta
  ) {
    return (
      event.choices[0].delta
        .content || ""
    );
  }

  return "";
}

function writeStreamError(
  res,
  message
) {
  if (!res.headersSent) {
    res
      .status(500)
      .send(message);

    return;
  }

  res.write(
    `\n\n${message}`
  );

  res.end();
}

/* =====================================================
   STREAMING ANSWER ROUTE
===================================================== */

app.post(
  "/answer",
  async (req, res) => {
    const {
      question,
      resumeText,
      interviewLevel,
      company,
      interviewType,
      history,
    } = req.body || {};

    const cleanQuestion =
      getCleanQuestion(question);

    if (!cleanQuestion) {
      return res
        .status(400)
        .send(
          "Question is empty"
        );
    }

    if (
      !process.env
        .OPENAI_API_KEY
    ) {
      return res
        .status(500)
        .send(
          "OPENAI_API_KEY is missing"
        );
    }

    try {
      const prompt =
        buildInterviewPrompt({
          question:
            cleanQuestion,

          resumeText,

          interviewLevel,

          company,

          interviewType,
        });

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

      const messages = [
        {
          role: "system",

          content:
            "Give accurate, natural interview answers. Use only verified resume facts. Never invent candidate details.",
        },
      ];

      if (
        Array.isArray(history)
      ) {
        history
          .slice(-6)
          .forEach((turn) => {
            if (
              !turn?.content
            ) {
              return;
            }

            messages.push({
              role:
                turn.role ===
                "assistant"
                  ? "assistant"
                  : "user",

              content: String(
                turn.content
              ),
            });
          });
      }

      messages.push({
        role: "user",
        content: prompt,
      });

      const openaiResponse =
        await fetch(
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
              model:
                OPENAI_MODEL,

              messages,

              stream: true,

              temperature:
                0.45,
            }),
          }
        );

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

        buffer +=
          decoder.decode(value, {
            stream: true,
          });

        const parts =
          buffer.split("\n\n");

        buffer =
          parts.pop() || "";

        for (
          const part of parts
        ) {
          const lines =
            part
              .split("\n")
              .filter((line) =>
                line.startsWith(
                  "data:"
                )
              );

          for (
            const line of lines
          ) {
            const eventData =
              line
                .replace(
                  /^data:\s*/,
                  ""
                )
                .trim();

            if (
              !eventData ||
              eventData ===
                "[DONE]"
            ) {
              continue;
            }

            try {
              const event =
                JSON.parse(
                  eventData
                );

              const delta =
                extractDeltaFromOpenAIEvent(
                  event
                );

              if (delta) {
                res.write(delta);
                res.flush?.();
              }
            } catch (
              parseError
            ) {
              console.error(
                "OpenAI stream parse error:",
                parseError
              );
            }
          }
        }
      }

      res.end();
    } catch (error) {
      console.error(
        "Answer Stream Error:",
        error
      );

      writeStreamError(
        res,
        "Server Error while generating answer."
      );
    }
  }
);

/* =====================================================
   START SERVER
===================================================== */

server.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );

  console.log(
    `OpenAI model: ${OPENAI_MODEL}`
  );
});