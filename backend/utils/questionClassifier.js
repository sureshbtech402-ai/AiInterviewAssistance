/**
 * Detect Interview Question Type
 *
 * IMPORTANT:
 * This classifier is intentionally deterministic and lightweight.
 *
 * Do NOT call an AI model only for classification.
 * The live interview path needs to remain fast.
 *
 * The classifier determines the most likely prompt category:
 *
 * SELF_INTRO
 * ARCHITECTURE
 * SCENARIO
 * CODING
 * CONCEPT
 */

/**
 * Normalize question text.
 */
function normalizeQuestion(question = "") {
  return String(question || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Check whether the question contains one of the supplied patterns.
 */
function containsPattern(question, patterns = []) {
  return patterns.some((pattern) => {
    return question.includes(pattern);
  });
}

/**
 * Detect Interview Question Type.
 */
export function classifyQuestion(question = "") {
  const q = normalizeQuestion(question);

  if (!q) {
    return "CONCEPT";
  }

  // ==================================================
  // SELF INTRODUCTION
  // ==================================================

  const selfIntroPatterns = [
    "tell me about yourself",
    "tell us about yourself",
    "introduce yourself",
    "can you introduce yourself",
    "could you introduce yourself",
    "please introduce yourself",
    "give me your introduction",
    "give us your introduction",
    "your introduction",
    "self introduction",
    "self-introduction",
    "brief introduction",
    "about yourself",
    "walk me through your resume",
    "walk me through the resume",
    "walk me through your cv",
    "walk me through your background",
    "tell me about your background",
    "tell me about your experience",
  ];

  if (containsPattern(q, selfIntroPatterns)) {
    return "SELF_INTRO";
  }

  // ==================================================
  // CODING
  // ==================================================
  //
  // Coding is checked before broad architecture/scenario
  // patterns because some coding questions contain words
  // such as "design" or "implement".
  // ==================================================

  const codingPatterns = [
    "write code",
    "write the code",
    "write a code",
    "write java code",
    "write python code",
    "write javascript code",
    "write a program",
    "program for",
    "write a function",
    "write a method",
    "implement this",
    "implement the",
    "implement a",
    "can you code",
    "could you code",
    "code this",
    "code for",
    "coding question",
    "coding problem",
    "solve this problem",
    "solve this using",
    "solve the problem",
    "algorithm for",
    "leetcode",
    "hackerrank",
    "codechef",
    "reverse string",
    "reverse a string",
    "reverse linked list",
    "find duplicates",
    "find duplicate",
    "remove duplicates",
    "remove duplicate",
    "check palindrome",
    "palindrome",
    "anagram",
    "fibonacci",
    "factorial",
    "binary search",
    "linear search",
    "sort an array",
    "sort the array",
    "merge two",
    "merge arrays",
    "find the maximum",
    "find the minimum",
    "count characters",
    "count frequency",
    "frequency of characters",
    "find missing number",
    "two sum",
  ];

  if (containsPattern(q, codingPatterns)) {
    return "CODING";
  }

  // ==================================================
  // ARCHITECTURE / SYSTEM DESIGN
  // ==================================================

  const architecturePatterns = [
    "system design",
    "system-design",
    "high level design",
    "high-level design",
    "low level design",
    "low-level design",
    "hld",
    "lld",
    "system architecture",
    "application architecture",
    "software architecture",
    "project architecture",
    "explain the architecture",
    "explain your architecture",
    "explain the project architecture",
    "explain your project architecture",
    "architecture of your project",
    "architecture of the application",
    "request flow",
    "request-response flow",
    "request response flow",
    "application flow",
    "project flow",
    "end to end flow",
    "end-to-end flow",
    "how request flows",
    "how the request flows",
    "how does the request flow",
    "how does a request flow",
    "how the application works",
    "how does the application work",
    "how does your application work",
    "microservice architecture",
    "microservices architecture",
    "microservice flow",
    "microservices flow",
    "service communication",
    "how services communicate",
    "service-to-service communication",
    "sequence diagram",
    "draw the architecture",
    "draw architecture",
    "deployment architecture",
    "deployment flow",
    "data flow",
    "component design",
    "architecture design",
  ];

  if (containsPattern(q, architecturePatterns)) {
    return "ARCHITECTURE";
  }

  // ==================================================
  // SCENARIO / BEHAVIORAL / PRACTICAL
  // ==================================================

  const scenarioPatterns = [
    "tell me about a time",
    "tell me about an incident",
    "tell me about a situation",
    "have you ever",
    "did you ever face",
    "how did you handle",
    "how have you handled",
    "what did you do when",
    "what would you do",
    "what will you do",
    "how would you handle",
    "how will you handle",
    "how would you approach",
    "how will you approach",
    "what is your approach",
    "what would be your approach",
    "production issue",
    "production problem",
    "production bug",
    "production incident",
    "production failure",
    "production outage",
    "critical issue",
    "critical bug",
    "critical production",
    "client issue",
    "client problem",
    "customer issue",
    "customer problem",
    "production support",
    "support issue",
    "team conflict",
    "conflict with a team member",
    "conflict with team member",
    "disagreement with",
    "tight deadline",
    "challenging situation",
    "challenging issue",
    "difficult situation",
    "difficult issue",
    "code review",
    "bug you fixed",
    "issue you faced",
    "problem you faced",
    "incident you handled",
    "failure you handled",
    "how did you fix",
    "how did you resolve",
    "how would you troubleshoot",
    "how will you troubleshoot",
    "troubleshoot this",
    "debug this issue",
    "debug a",
  ];

  if (containsPattern(q, scenarioPatterns)) {
    return "SCENARIO";
  }

  // ==================================================
  // ARCHITECTURE SHORTCUTS
  // ==================================================
  //
  // These are intentionally more specific than simply checking
  // for the word "design".
  // ==================================================

  const architectureQuestionPatterns = [
    "design a system",
    "design an application",
    "design an api",
    "design a scalable",
    "design a scalable system",
    "design a scalable application",
    "how would you design",
    "how will you design",
    "how do you design",
    "how would you architect",
    "how will you architect",
    "how do you architect",
  ];

  if (containsPattern(q, architectureQuestionPatterns)) {
    return "ARCHITECTURE";
  }

  // ==================================================
  // SCENARIO SHORTCUTS
  // ==================================================

  const scenarioQuestionPatterns = [
    "what if the",
    "what if your",
    "suppose the",
    "suppose your",
    "imagine the",
    "imagine your",
  ];

  if (containsPattern(q, scenarioQuestionPatterns)) {
    return "SCENARIO";
  }

  // ==================================================
  // DEFAULT
  // ==================================================
  //
  // Most normal technical interview questions are concept
  // questions:
  //
  // "What is HashMap?"
  // "What is dependency injection?"
  // "Difference between HashMap and Hashtable?"
  // "What is REST?"
  //
  // These should go to the concept prompt.
  // ==================================================

  return "CONCEPT";
}