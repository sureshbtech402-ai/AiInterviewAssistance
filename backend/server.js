import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";

import healthRouter from "./routes/health.js";
import transcriptionRouter from "./routes/transcription.js";
import resumeRouter from "./routes/resume.js";
import answerRouter from "./routes/answer.js";

import { initializeDeepgramSocket } from "./services/deepgramService.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*",
    credentials: true,
  })
);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

// ------------------------
// Routes
// ------------------------

app.use("/", healthRouter);
app.use("/", transcriptionRouter);
app.use("/", resumeRouter);
app.use("/", answerRouter);

// ------------------------
// HTTP Server
// ------------------------

const server = http.createServer(app);

// ------------------------
// WebSocket
// ------------------------

const wss = new WebSocketServer({
  server,
  path: "/listen",
});

wss.on("connection", (client) => {
  console.log("Client Connected");
  initializeDeepgramSocket(client);
});

// ------------------------
// Start Server
// ------------------------

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`
========================================
 AI Interview Assistant Backend
========================================
Server Running : http://localhost:${PORT}
WebSocket      : ws://localhost:${PORT}/listen
========================================
`);
});