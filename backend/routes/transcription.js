import express from "express";
import multer from "multer";
import fs from "fs";
import deepgram from "../services/deepgramService.js";

const router = express.Router();

const upload = multer({
  dest: "uploads/",
});

router.post(
  "/transcribe",
  upload.single("audio"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          text: "No audio file received",
        });
      }

      const audioBuffer = fs.readFileSync(req.file.path);

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

      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("File delete error:", err);
      }

      if (error) {
        throw error;
      }

      const transcript =
        result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ||
        "";

      return res.json({
        text: transcript,
      });
    } catch (err) {
      console.error("Transcription Error:", err);

      return res.status(500).json({
        text: "Transcription Error",
      });
    }
  }
);

export default router;