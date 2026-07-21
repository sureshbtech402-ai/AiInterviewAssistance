import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

export function initializeDeepgramSocket(client) {
  if (!process.env.DEEPGRAM_API_KEY) {
    client.send(
      JSON.stringify({
        type: "error",
        message: "Missing DEEPGRAM_API_KEY",
      })
    );
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
      console.error("Deepgram keepAlive Error:", err);
    }
  }, 5000);

  function send(payload) {
    if (client.readyState === 1) {
      client.send(JSON.stringify(payload));
    }
  }

  dgConnection.on(LiveTranscriptionEvents.Open, () => {
    console.log("Deepgram Connected");

    deepgramReady = true;

    send({
      type: "status",
      status: "connected",
    });

    while (pendingAudio.length > 0) {
      dgConnection.send(pendingAudio.shift());
    }
  });

  dgConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const transcript =
      data?.channel?.alternatives?.[0]?.transcript || "";

    if (!transcript.trim()) return;

    send({
      type: "transcript",
      text: transcript,
      isFinal: Boolean(data?.is_final),
      speechFinal: Boolean(data?.speech_final),
    });
  });

  dgConnection.on(LiveTranscriptionEvents.Error, (err) => {
    console.error("Deepgram Error:", err);

    send({
      type: "error",
      message: "Deepgram transcription failed",
    });
  });

  dgConnection.on(LiveTranscriptionEvents.Close, () => {
    deepgramReady = false;
    clearInterval(keepAlive);

    if (!closedByClient) {
      send({
        type: "status",
        status: "closed",
      });
    }
  });

  client.on("message", (audio) => {
    if (!audio) return;

    try {
      if (deepgramReady && dgConnection.getReadyState() === 1) {
        dgConnection.send(audio);
      } else {
        pendingAudio.push(audio);

        if (pendingAudio.length > 50) {
          pendingAudio.shift();
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  client.on("close", () => {
    closedByClient = true;

    clearInterval(keepAlive);

    try {
      dgConnection.finish();
    } catch (err) {
      console.error(err);
    }
  });

  client.on("error", (err) => {
    console.error(err);
  });
}

export default deepgram;