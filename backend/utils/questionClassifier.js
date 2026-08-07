/**
 * Detect Interview Question Type
 */

export function classifyQuestion(question = "") {
  const q = String(question || "").toLowerCase().trim();

  // ==================================
  // SELF INTRODUCTION
  // ==================================

  const selfIntroPatterns = [
    "tell me about yourself",
    "introduce yourself",
    "walk me through your resume",
    "walk me through resume",
    "self introduction",
    "about yourself",
    "your introduction",
    "brief introduction",
    "can you introduce yourself",
  ];

  if (selfIntroPatterns.some(pattern => q.includes(pattern))) {
    return "SELF_INTRO";
  }

  // ==================================
  // ARCHITECTURE / SYSTEM DESIGN
  // ==================================

  const architecturePatterns = [
    "architecture",
    "system design",
    "high level design",
    "low level design",
    "hld",
    "lld",
    "request flow",
    "application flow",
    "project flow",
    "workflow",
    "deployment",
    "microservice flow",
    "sequence diagram",
    "draw architecture",
    "design",
    "how request flows",
    "how the request flows",
    "end to end flow",
  ];

  if (architecturePatterns.some(pattern => q.includes(pattern))) {
    return "ARCHITECTURE";
  }

  // ==================================
  // SCENARIO / BEHAVIORAL
  // ==================================

  const scenarioPatterns = [
    "tell me about a time",
    "have you ever",
    "how did you handle",
    "what would you do",
    "how would you handle",
    "production issue",
    "production bug",
    "critical issue",
    "critical bug",
    "client issue",
    "customer issue",
    "production support",
    "team conflict",
    "deadline",
    "challenging situation",
    "code review",
    "bug you fixed",
    "issue you faced",
  ];

  if (scenarioPatterns.some(pattern => q.includes(pattern))) {
    return "SCENARIO";
  }

  // ==================================
  // CODING
  // ==================================

  const codingPatterns = [
    "write code",
    "write a program",
    "program for",
    "implement",
    "coding question",
    "algorithm",
    "leetcode",
    "hackerrank",
    "print",
    "find duplicates",
    "remove duplicates",
    "reverse string",
    "palindrome",
    "anagram",
    "fibonacci",
    "factorial",
    "binary search",
    "linear search",
    "sort an array",
    "merge two",
    "code for",
    "write java code",
    "write the code",
    "can you code",
    "solve this",
  ];

  if (codingPatterns.some(pattern => q.includes(pattern))) {
    return "CODING";
  }

  // ==================================
  // DEFAULT
  // ==================================

  return "CONCEPT";
}