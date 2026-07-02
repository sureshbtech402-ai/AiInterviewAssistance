import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();

const upload = multer({
  dest: "uploads/",
});

app.use(cors());
app.use(express.json());

// Test Route
app.get("/", (req, res) => {
  res.send("Backend Running");
});


// Transcribe Route
app.post(
  "/transcribe",
  upload.single("audio"),
  async (req, res) => {
    try {

      const audioData = fs.readFileSync(
        req.file.path
      );

      const base64Audio =
        audioData.toString("base64");

      const result =
        await model.generateContent([
          {
            inlineData: {
              mimeType: "audio/webm",
              data: base64Audio,
            },
          },
          `
            You are a speech-to-text engine.

            Listen carefully to this interview audio.

            Rules:
            - Return the exact spoken words.
            - Correct minor grammar mistakes.
            - If the speaker is asking a technical interview question, return the full question.
            - Do not summarize.
            - Do not answer.
            - Output only the transcript.

          Do not explain.
          Do not answer.
          `,
        ]);

      const text =
        result.response.text();

      res.json({
        text,
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        text: "Transcription Error",
      });
    }
  }
);

// Answer Route
app.post("/answer", async (req, res) => {
  try {
        const {
          question,
          resumeText,
          interviewLevel,
          company,
          interviewType
      } = req.body;

const prompt = `
You are an experienced Indian Senior Software Engineer and Technical Interview Coach.

Your job is to generate interview-ready answers exactly like a real software engineer would answer during a live interview.

======================================================
CANDIDATE PROFILE
======================================================

Resume:
${resumeText}

======================================================
INTERVIEW DETAILS
======================================================

Company:
${company}

Interview Level:
${interviewLevel}

Interview Type:
${interviewType}

======================================================
QUESTION
======================================================

${question}

======================================================
RULES
======================================================

1. Analyze the resume before answering.

2. If possible, connect the answer with the candidate's project experience.

3. Never invent fake experience.

4. Use very simple Indian spoken English.

5. The answer should sound like a real interview candidate, not like ChatGPT or a textbook.

6. Keep the Interview Ready Answer between 120-180 words.

7. Avoid unnecessary definitions or history.

8. Highlight important technical words using Markdown bold.
Example:
**Spring Boot**
**REST API**
**Microservices**
**Dependency Injection**

======================================================
INTERVIEW LEVEL
======================================================

Fresher
- Basic concepts
- Very simple English
- Beginner examples

Junior
- Explain concept
- Mention one project example

Mid Level
- Explain concept
- Mention best practices
- Mention project implementation

Senior
- Production experience
- Performance
- Scalability
- Security
- Trade-offs

Lead / Architect
- Enterprise architecture
- Distributed systems
- Design decisions

======================================================
INTERVIEW TYPE
======================================================

Technical
- Focus on concepts.

HR
- Professional and confident answers.

Behavioral
- Use STAR format.

Managerial
- Leadership and ownership.

System Design
- Components
- Scaling
- Cache
- Database
- Security

Coding
- Explain approach first.
- Return optimized code.

======================================================
CODING RULES
======================================================

If the question is a coding/programming question:

Return:
- Interview Ready Answer
- Complete working code
- Programming language
- Time Complexity
- Space Complexity
- Sample Output (if applicable)
- Short explanation of the code
- Important implementation notes

Supported languages include:

Java
Spring Boot
SQL
PL/SQL
JavaScript
TypeScript
Python
C
C++
HTML
CSS
JSON
XML

Never skip the code.

Never return only theory.

Always generate executable code.

Use proper formatting and indentation.

Prefer optimized solutions.

If the question is NOT coding:

code = ""
language = ""
timeComplexity = ""
spaceComplexity = ""
output = ""
notes = ""

======================================================
RETURN JSON ONLY
======================================================

{
  "answer":"",
  "keyPoints":[
    "",
    "",
    ""
  ],
  "projectAnswer":"",
  "code":"",
  "language":"",
  "timeComplexity":"",
  "spaceComplexity":"",
  "output":"",
  "notes":""
  "codeExplanation":""
}

Rules:

- Return ONLY valid JSON.
- Do NOT return markdown.
- Do NOT return explanations outside JSON.
- Do NOT wrap JSON inside \`\`\`.
`;

const response = await client.responses.create({
  model: "gpt-5.5",
  input: prompt,
});

let responseText = response.output_text;

responseText = responseText
  .replace(/```json/g, "")
  .replace(/```/g, "")
  .trim();

const parsed = JSON.parse(responseText);

res.json(parsed);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      answer: "Server Error",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});