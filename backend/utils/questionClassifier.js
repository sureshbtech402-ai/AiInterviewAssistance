function normalizeQuestion(question = "") {
  return String(question || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(question, patterns = []) {
  return patterns.some((pattern) => {
    if (pattern.includes(" ") || pattern.includes("-")) {
      return question.includes(pattern);
    }
    const regex = new RegExp(`\\b${pattern}\\b`, "i");
    return regex.test(question);
  });
}

export function classifyQuestion(question = "") {
  const q = normalizeQuestion(question);

  if (!q) {
    return "CONCEPT";
  }

  // ==================================================
  // 1. SELF INTRODUCTION
  // ==================================================
  const selfIntroPatterns = [
    "tell me about yourself",
    "tell us about yourself",
    "introduce yourself",
    "can you introduce yourself",
    "could you introduce yourself",
    "please introduce yourself",
    "give me your introduction",
    "give your introduction",
    "your introduction",
    "self introduction",
    "self-introduction",
    "about yourself",
    "walk me through your resume",
    "walk me through your cv",
    "walk me through your profile",
    "walk me through your background",
    "tell me about your background",
    "give a brief about yourself",
    "give a quick intro",
  ];

  if (containsAny(q, selfIntroPatterns)) {
    return "SELF_INTRO";
  }

  // ==================================================
  // 2. CODING / SYNTAX / QUERIES
  // ==================================================
  const codingPatterns = [
    "write code",
    "write the code",
    "give me code",
    "give me the code",
    "show me code",
    "show me the code",
    "code snippet",
    "write a program",
    "write program",
    "write a method",
    "write the method",
    "write a function",
    "write the function",
    "create a method",
    "create a function",
    "can you code",
    "could you code",
    "coding question",
    "coding problem",
    "solve this problem",
    "solve the problem",
    "solve this using",
    "implement this in",
    "implement the code",
    "implementation code",
    "give me the syntax",
    "show me the syntax",
    "write syntax",
    "give syntax",
    "write logic",

    // Common coding problem keywords
    "reverse string",
    "reverse a string",
    "reverse linked list",
    "reverse array",
    "find duplicate",
    "find duplicates",
    "duplicate characters",
    "duplicates in string",
    "remove duplicate",
    "remove duplicates",
    "palindrome",
    "anagram",
    "fibonacci",
    "factorial",
    "binary search",
    "linear search",
    "sort an array",
    "sort the array",
    "merge arrays",
    "find maximum",
    "find minimum",
    "count characters",
    "count frequency",
    "frequency of characters",
    "find missing number",
    "two sum",

    // Language triggers
    "java code",
    "python code",
    "javascript code",
    "sql query",
    "write sql",
    "write a query",
    "write query",
    "select query",
    "git command",
    "shell script",
    "bash script",
  ];

  if (containsAny(q, codingPatterns)) {
    return "CODING";
  }

  // ==================================================
  // 3. SCENARIO / TROUBLESHOOTING / BUG RESOLUTION (Evaluated before Project)
  // ==================================================
  const scenarioPatterns = [
    "if any bug",
    "how your resolving",
    "how you resolve",
    "how do you resolve",
    "how you are resolving",
    "how you fix",
    "how do you fix",
    "how did you fix",
    "how did you resolve",
    "resolving bugs",
    "resolve bugs",
    "fix bugs",
    "fixing bugs",
    "production issue",
    "production bug",
    "production incident",
    "production outage",
    "critical issue",
    "critical bug",
    "production problem",
    "tell me about a time",
    "tell me about an incident",
    "tell me about a situation",
    "did you ever face",
    "what did you do when",
    "what would you do",
    "what will you do",
    "how would you handle",
    "how will you handle",
    "how would you approach",
    "how would you troubleshoot",
    "how do you troubleshoot",
    "how do you debug",
    "troubleshoot this",
    "debug this issue",
    "troubleshoot the issue",
  ];

  if (containsAny(q, scenarioPatterns)) {
    return "SCENARIO";
  }

  // ==================================================
  // 4. ARCHITECTURE / FLOW
  // ==================================================
  const architecturePatterns = [
    "system design",
    "high level design",
    "low level design",
    "hld",
    "lld",
    "system architecture",
    "application architecture",
    "software architecture",
    "project architecture",
    "framework architecture",
    "architecture of your project",
    "explain the architecture",
    "explain your architecture",
    "how is your application designed",
    "framework design",
    "selenium framework",
    "bdd framework",
    "request flow",
    "request-response flow",
    "application flow",
    "api flow",
    "end to end flow",
    "service communication",
    "microservice communication",
    "how microservices communicate",
    "design a system",
    "how would you design",
  ];

  if (containsAny(q, architecturePatterns)) {
    return "ARCHITECTURE";
  }

  // ==================================================
  // 5. PROJECT / ROLES & RESPONSIBILITIES
  // ==================================================
  const projectPatterns = [
    "explain your project",
    "explain the project",
    "explain your current project",
    "tell me about your project",
    "tell me about the project",
    "what is your project",
    "what is the project you are working on",
    "what project are you working on",
    "current project",
    "describe your project",
    "walk me through your project",
    "tech stack in your project",
    "roles and responsibilities",
    "your responsibilities",
    "what are your responsibilities",
    "what is your role in the project",
    "what do you do in your project",
    "what exactly do you do",
    "what is your contribution",
    "daily work",
    "daily basis",
    "day to day work",
    "daily activities",
    "what do you do on a daily basis",
    "what do you do daily",
    "what is your daily work",
    "what are you working on",
  ];

  if (containsAny(q, projectPatterns)) {
    return "PROJECT";
  }

  // ==================================================
  // 6. DEFAULT TO CONCEPT
  // ==================================================
  return "CONCEPT";
}