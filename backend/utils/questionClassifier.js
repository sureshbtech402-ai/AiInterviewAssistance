/**
 * Detect interview question type.
 */

export function classifyQuestion(question = "") {
  const q = question.toLowerCase().trim();

  // ==================================
  // SELF INTRODUCTION
  // ==================================

  if (
    q.includes("tell me about yourself") ||
    q.includes("introduce yourself") ||
    q.includes("walk me through your resume") ||
    q.includes("walk me through resume") ||
    q.includes("self introduction") ||
    q === "about yourself"
  ) {
    return "SELF_INTRO";
  }

  // ==================================
  // ARCHITECTURE
  // ==================================

  if (
    q.includes("architecture") ||
    q.includes("system design") ||
    q.includes("hld") ||
    q.includes("lld") ||
    q.includes("high level design") ||
    q.includes("low level design") ||
    q.includes("request flow") ||
    q.includes("application flow") ||
    q.includes("project flow") ||
    q.includes("workflow") ||
    q.includes("deployment") ||
    q.includes("microservice flow") ||
    q.includes("draw architecture") ||
    q.includes("sequence diagram")
  ) {
    return "ARCHITECTURE";
  }

  // ==================================
  // SCENARIO
  // ==================================

  if (
    q.includes("tell me about a time") ||
    q.includes("have you ever") ||
    q.includes("how did you handle") ||
    q.includes("what would you do") ||
    q.includes("production issue") ||
    q.includes("critical issue") ||
    q.includes("production bug") ||
    q.includes("customer issue") ||
    q.includes("client issue") ||
    q.includes("team conflict") ||
    q.includes("deadline") ||
    q.includes("code review experience")
  ) {
    return "SCENARIO";
  }

  // ==================================
  // CODING
  // ==================================

  if (
    q.includes("write code") ||
    q.includes("write a program") ||
    q.includes("program for") ||
    q.includes("implement") ||
    q.includes("algorithm") ||
    q.includes("leetcode") ||
    q.includes("hackerrank") ||
    q.includes("coding question") ||
    q.includes("print") ||
    q.includes("find duplicates") ||
    q.includes("reverse string") ||
    q.includes("palindrome") ||
    q.includes("anagram") ||
    q.includes("fibonacci") ||
    q.includes("factorial") ||
    q.includes("binary search") ||
    q.includes("sort an array") ||
    q.includes("merge two") ||
    q.includes("remove duplicates")
  ) {
    return "CODING";
  }

  // ==================================
  // DEFAULT
  // ==================================

  return "CONCEPT";
}