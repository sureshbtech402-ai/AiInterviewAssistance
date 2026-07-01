require("dotenv").config();

const WebSocket = require("ws");
const {
  createClient,
  LiveTranscriptionEvents,
} = require("@deepgram/sdk");

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Local websocket server
const wss = new WebSocket.Server({
  port: 5001,
});

console.log("✅ Local WebSocket running on port 5001");

wss.on("connection", (client) => {
  console.log("🟢 React Connected");

  const dgConnection = deepgram.listen.live({
    model: "nova-3",
    language: "en",
    punctuate: true,
    interim_results: true,
    smart_format: true,
  });

  dgConnection.on(LiveTranscriptionEvents.Open, () => {
    console.log("✅ Deepgram Connected");

    client.on("message", (audioChunk) => {
      if (dgConnection.getReadyState() === 1) {
        dgConnection.send(audioChunk);
      }
    });
  });

  dgConnection.on(
    LiveTranscriptionEvents.Transcript,
    (data) => {
      const transcript =
        data.channel.alternatives[0].transcript;

      if (transcript && transcript.trim() !== "") {
        console.log("🎤", transcript);

        client.send(transcript);
      }
    }
  );

  dgConnection.on(
    LiveTranscriptionEvents.Error,
    (err) => {
      console.error("❌ Deepgram Error");
      console.error(err);
    }
  );

  dgConnection.on(
    LiveTranscriptionEvents.Close,
    () => {
      console.log("🔴 Deepgram Closed");
    }
  );

  client.on("close", () => {
    console.log("🔴 React Closed");
    dgConnection.finish();
  });
});