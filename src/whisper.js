import { pipeline } from "@xenova/transformers";

let transcriber = null;

export async function loadWhisper() {
  if (!transcriber) {
    transcriber = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny.en"
    );
  }
  return transcriber;
}