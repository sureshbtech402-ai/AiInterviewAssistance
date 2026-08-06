/**
 * Returns interview question type.
 */
export function classifyQuestion(question = "") {

  const q = (question || "").toLowerCase().trim();

  // ============================
  // SELF INTRODUCTION
  // ============================

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

  // ============================
  // ARCHITECTURE
  // ============================

  if (
    q.includes("architecture") ||
    q.includes("system design") ||
    q.includes("high level design") ||
    q.includes("low level design") ||
    q.includes("request flow") ||
    q.includes("application flow") ||
    q.includes("project flow") ||
    q.includes("workflow") ||
    q.includes("deployment") ||
    q.includes("sequence diagram") ||
    q.includes("microservice flow") ||
    q.includes("draw architecture")
  ) {
    return "ARCHITECTURE";
  }

  // ============================
  // SCENARIO
  // ============================

  if (
    q.includes("tell me about a time") ||
    q.includes("have you ever") ||
    q.includes("what would you do") ||
    q.includes("how did you handle") ||
    q.includes("production issue") ||
    q.includes("production support") ||
    q.includes("critical issue") ||
    q.includes("customer issue") ||
    q.includes("client issue") ||
    q.includes("production bug") ||
    q.includes("team conflict") ||
    q.includes("deadline") ||
    q.includes("code review experience")
  ) {
    return "SCENARIO";
  }

  // ============================
  // CODING
  // ============================

  if (

    q.includes("write code") ||
    q.includes("write a program") ||
    q.includes("algorithm") ||
    q.includes("coding question") ||
    q.includes("implement") ||
    q.includes("leetcode") ||
    q.includes("hackerrank") ||

    q.includes("reverse string") ||
    q.includes("palindrome") ||
    q.includes("anagram") ||
    q.includes("fibonacci") ||
    q.includes("factorial") ||
    q.includes("binary search") ||
    q.includes("linked list") ||
    q.includes("hashmap") ||
    q.includes("dynamic programming") ||
    q.includes("sliding window")
  ) {
    return "CODING";
  }

  // ============================
  // DEFAULT
  // ============================

  return "CONCEPT";
}