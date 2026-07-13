/* =====================================================
   PROMPT BUILDER
   Natural interview prompts for GPT-4o-mini
===================================================== */

export function getCleanQuestion(question) {
  if (!question) return "";

  if (typeof question === "string") {
    return question.trim();
  }

  if (typeof question === "object") {
    return String(
      question.question ||
        question.text ||
        question.transcript ||
        ""
    ).trim();
  }

  return String(question).trim();
}

/* =====================================================
   QUESTION CLASSIFICATION
===================================================== */

export function isSelfIntroductionQuestion(question = "") {
  const q = getCleanQuestion(question).toLowerCase();

  return (
    q.includes("tell me about yourself") ||
    q.includes("tell me about you") ||
    q.includes("introduce yourself") ||
    q.includes("self introduction") ||
    q.includes("about yourself") ||
    q.includes("your self") ||
    q.includes("professional profile")
  );
}

export function isProjectQuestion(question = "") {
  const q = getCleanQuestion(question).toLowerCase();

  return (
    q.includes("explain your project") ||
    q.includes("about your project") ||
    q.includes("current project") ||
    q.includes("project overview") ||
    q.includes("project architecture") ||
    q.includes("project flow") ||
    q.includes("project functionality") ||
    q.includes("project description")
  );
}

export function isRolesQuestion(question = "") {
  const q = getCleanQuestion(question).toLowerCase();

  return (
    q.includes("roles and responsibilities") ||
    q.includes("your responsibilities") ||
    q.includes("daily activities") ||
    q.includes("day to day activities") ||
    q.includes("your role in project") ||
    q.includes("what is your role")
  );
}

export function isCodingQuestion(question = "") {
  const q = getCleanQuestion(question).toLowerCase();

  const codingKeywords = [
    "write a program",
    "write code",
    "write a java",
    "write a query",
    "sql query",
    "implement",
    "coding question",
    "code snippet",
    "algorithm",
    "reverse string",
    "remove duplicate",
    "find duplicate",
    "second highest",
    "sort the",
    "time complexity",
    "space complexity",
  ];

  return codingKeywords.some((keyword) => q.includes(keyword));
}

export function isBehavioralQuestion(question = "") {
  const q = getCleanQuestion(question).toLowerCase();

  const behavioralKeywords = [
    "tell me about a time",
    "difficult situation",
    "conflict",
    "challenge you faced",
    "production issue",
    "critical bug",
    "team disagreement",
    "deadline",
    "failure",
    "mistake",
    "leadership",
    "pressure",
  ];

  return behavioralKeywords.some((keyword) => q.includes(keyword));
}

export function isHrQuestion(question = "") {
  const q = getCleanQuestion(question).toLowerCase();

  const hrKeywords = [
    "why should we hire you",
    "why do you want to join",
    "why are you looking for change",
    "strengths and weaknesses",
    "your strengths",
    "your weakness",
    "salary expectation",
    "notice period",
    "career goals",
    "where do you see yourself",
    "why this company",
  ];

  return hrKeywords.some((keyword) => q.includes(keyword));
}

/* =====================================================
   COMMON RULES
===================================================== */

function getCommonGroundingRules(resumeText) {
  return `
Candidate Resume Profile:
${resumeText || "Resume profile not available"}

Important grounding rules:
- Use only facts available in the Candidate Resume Profile.
- Never invent company names, projects, clients, experience, dates, metrics, achievements, tools, or responsibilities.
- Use resume details only when relevant to the question.
- When a resume detail is unavailable, answer safely and generally.
- Never say "according to my resume".
`;
}

function getNaturalSpeakingRules() {
  return `
Speaking style:
- Answer like a confident candidate speaking in a real interview.
- Use simple and natural Indian spoken English.
- Use short, clear sentences.
- Start directly with the answer.
- Avoid textbook-style explanations.
- Avoid unnecessary corporate words.
- Do not start with "So", "Basically", "Actually", "Mainly", or "Like".
- Use first-person language naturally when discussing experience or projects.
- Use **bold** only for important technical terms.
`;
}

/* =====================================================
   SELF INTRODUCTION PROMPT
===================================================== */

export function buildSelfIntroductionPrompt({
  question,
  resumeText,
  interviewLevel,
  interviewType,
}) {
  const cleanQuestion = getCleanQuestion(question);

  return `
You are helping a candidate answer a self-introduction question in a real interview.

${getCommonGroundingRules(resumeText)}

Interview Level: ${interviewLevel || "Mid Level"}
Interview Type: ${interviewType || "Technical"}
Question: ${cleanQuestion}

${getNaturalSpeakingRules()}

Create a natural self-introduction with this flow:

1. Politely thank the interviewer.
2. Mention candidate name and location only when available.
3. Mention total experience and primary role.
4. Mention the current company.
5. Briefly mention previous companies when available.
6. Mention core technical skills.
7. Mention the current or most recent project and its domain.
8. Mention two or three important responsibilities naturally.
9. End with a simple career-growth statement and "Thank you."

Additional rules:
- Mention the current company first.
- Mention previous companies briefly after the current company.
- If only one company exists, mention only that company.
- Do not use the target-company dropdown as the candidate's employer.
- Keep the introduction between 140 and 170 words.
- The introduction must sound spoken, not written.
- Do not copy a fixed template word for word.

Return only this Markdown:

## 🎯 Self Introduction

Write one natural spoken paragraph.

## ⭐ Roles and Responsibilities

- Start with a strong technical verb.
- Start with a strong technical verb.
- Start with a strong technical verb.
`;
}

/* =====================================================
   PROJECT PROMPT
===================================================== */

export function buildProjectPrompt({
  question,
  resumeText,
  interviewLevel,
  interviewType,
}) {
  const cleanQuestion = getCleanQuestion(question);

  return `
You are helping a candidate explain a project in a real technical interview.

${getCommonGroundingRules(resumeText)}

Interview Level: ${interviewLevel || "Mid Level"}
Interview Type: ${interviewType || "Technical"}
Question: ${cleanQuestion}

${getNaturalSpeakingRules()}

Explain the project in this order:

1. Project name and business domain.
2. Business purpose of the application.
3. Main modules or functional flow.
4. Technology stack used.
5. Candidate's role and contribution.
6. One important technical responsibility or challenge.

Rules:
- Explain the current or most recent project first.
- Mention previous projects only when relevant.
- Keep the answer between 120 and 150 words.
- Do not invent modules, clients, technologies, or achievements.
- Use natural phrases such as:
  "In my project..."
  "The main purpose of the application is..."
  "My responsibility was..."
  "I worked on..."

Return only this Markdown:

## 🎯 Project Explanation

Write one natural spoken paragraph.

## ⭐ Key Responsibilities

- Start with a technical action verb.
- Start with a technical action verb.
- Start with a technical action verb.
`;
}

/* =====================================================
   ROLES AND RESPONSIBILITIES PROMPT
===================================================== */

export function buildRolesPrompt({
  question,
  resumeText,
  interviewLevel,
  interviewType,
}) {
  const cleanQuestion = getCleanQuestion(question);

  return `
You are helping a candidate explain roles and responsibilities in a real interview.

${getCommonGroundingRules(resumeText)}

Interview Level: ${interviewLevel || "Mid Level"}
Interview Type: ${interviewType || "Technical"}
Question: ${cleanQuestion}

${getNaturalSpeakingRules()}

Answer rules:
- Start with a short spoken introduction of around 40 to 60 words.
- Then provide exactly three responsibility points.
- Every responsibility must start with a strong technical verb.
- Use only responsibilities supported by the resume.
- Do not use pronouns at the beginning of bullet points.

Good starting verbs:
Developed, Implemented, Integrated, Designed, Optimized, Deployed,
Containerized, Tested, Resolved, Configured, Automated, Maintained.

Return only this Markdown:

## 🎯 Interview Ready Answer

Write a short natural spoken paragraph.

## ⭐ Roles and Responsibilities

- Technical action verb...
- Technical action verb...
- Technical action verb...
`;
}

/* =====================================================
   TECHNICAL CONCEPT PROMPT
===================================================== */

export function buildConceptPrompt({
  question,
  resumeText,
  interviewLevel,
  interviewType,
}) {
  const cleanQuestion = getCleanQuestion(question);

  return `
You are helping a candidate answer a technical concept question in a real interview.

${getCommonGroundingRules(resumeText)}

Interview Level: ${interviewLevel || "Mid Level"}
Interview Type: ${interviewType || "Technical"}
Question: ${cleanQuestion}

${getNaturalSpeakingRules()}

Answer in this order:

1. Give a direct and simple definition.
2. Explain why it is used.
3. Explain the important difference, behaviour, or components.
4. Give one practical example.
5. Connect it to the candidate's project only when supported by the resume.

Rules:
- Keep the main answer between 100 and 130 words.
- Do not force a project example when the resume does not support it.
- When project usage is unavailable, clearly give a general practical example.
- Do not use action-verb bullets for simple comparison questions.
- For comparison questions, explain both sides clearly.
- For annotation or framework questions, explain the main components simply.

Return only this Markdown:

## 🎯 Interview Ready Answer

Write one clear and natural spoken answer.

## ⭐ Key Points

- Important point.
- Important point.
- Important point.

## 📄 Practical or Project Example

Write 2 to 4 natural sentences.
`;
}

/* =====================================================
   CODING PROMPT
===================================================== */

export function buildCodingPrompt({
  question,
  resumeText,
}) {
  const cleanQuestion = getCleanQuestion(question);

  return `
You are helping a candidate solve a coding question in a real interview.

${getCommonGroundingRules(resumeText)}

Question: ${cleanQuestion}

Coding rules:
- Use the programming language explicitly requested in the question.
- When no language is requested, use the candidate's primary programming language.
- For a Java backend candidate, default to Java.
- For database questions, use SQL.
- Give a simple and interview-friendly solution.
- Provide complete compilable or executable code.
- Avoid unnecessary advanced logic.
- Add only useful comments.
- Do not invent resume experience.

Return only this Markdown:

## 💻 Code

Provide the complete working code in a fenced code block.

## 📘 Code Explanation

Explain the approach naturally in 3 to 5 short sentences.

## ⏱ Complexity

Mention time complexity and space complexity.

## ▶ Sample Output

Include only when useful.
`;
}

/* =====================================================
   BEHAVIORAL PROMPT
===================================================== */

export function buildBehavioralPrompt({
  question,
  resumeText,
  interviewLevel,
}) {
  const cleanQuestion = getCleanQuestion(question);

  return `
You are helping a candidate answer a behavioral interview question.

${getCommonGroundingRules(resumeText)}

Interview Level: ${interviewLevel || "Mid Level"}
Question: ${cleanQuestion}

${getNaturalSpeakingRules()}

Use the STAR approach naturally:

- Situation: Briefly explain the context.
- Task: Explain the responsibility.
- Action: Explain what the candidate did.
- Result: Explain the outcome.

Rules:
- Do not label every sentence as Situation, Task, Action, and Result.
- Make it sound like one natural spoken story.
- Use a real resume example when available.
- When the resume does not contain enough information, provide a safe generic software-project example without fake company names or metrics.
- Keep the answer between 120 and 150 words.

Return only this Markdown:

## 🎯 Interview Ready Answer

Write one natural STAR-style spoken answer.

## ⭐ What I Learned

Write 2 short practical points.
`;
}

/* =====================================================
   HR PROMPT
===================================================== */

export function buildHrPrompt({
  question,
  resumeText,
  company,
  interviewLevel,
}) {
  const cleanQuestion = getCleanQuestion(question);

  return `
You are helping a candidate answer an HR interview question.

${getCommonGroundingRules(resumeText)}

Target Company: ${company || "the company"}
Interview Level: ${interviewLevel || "Mid Level"}
Question: ${cleanQuestion}

${getNaturalSpeakingRules()}

Rules:
- Keep the answer positive and professional.
- Do not criticize current or previous employers.
- Do not invent company-specific facts.
- Use the target company only when the question is about joining that company.
- Connect the answer to skills, learning, contribution, ownership, and career growth.
- Keep the answer between 90 and 120 words.

Return only this Markdown:

## 🎯 Interview Ready Answer

Write one natural spoken HR answer.

## ⭐ Key Message

Write 2 short supporting points.
`;
}

/* =====================================================
   PROMPT ROUTER
===================================================== */

export function buildInterviewPrompt({
  question,
  resumeText,
  interviewLevel,
  company,
  interviewType,
}) {
  const cleanQuestion = getCleanQuestion(question);

  if (isSelfIntroductionQuestion(cleanQuestion)) {
    return buildSelfIntroductionPrompt({
      question: cleanQuestion,
      resumeText,
      interviewLevel,
      interviewType,
    });
  }

  if (isProjectQuestion(cleanQuestion)) {
    return buildProjectPrompt({
      question: cleanQuestion,
      resumeText,
      interviewLevel,
      interviewType,
    });
  }

  if (isRolesQuestion(cleanQuestion)) {
    return buildRolesPrompt({
      question: cleanQuestion,
      resumeText,
      interviewLevel,
      interviewType,
    });
  }

  if (isCodingQuestion(cleanQuestion)) {
    return buildCodingPrompt({
      question: cleanQuestion,
      resumeText,
    });
  }

  if (isBehavioralQuestion(cleanQuestion)) {
    return buildBehavioralPrompt({
      question: cleanQuestion,
      resumeText,
      interviewLevel,
    });
  }

  if (isHrQuestion(cleanQuestion)) {
    return buildHrPrompt({
      question: cleanQuestion,
      resumeText,
      company,
      interviewLevel,
    });
  }

  return buildConceptPrompt({
    question: cleanQuestion,
    resumeText,
    interviewLevel,
    interviewType,
  });
}