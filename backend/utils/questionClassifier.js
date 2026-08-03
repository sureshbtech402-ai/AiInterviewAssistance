/**
 * Returns the interview question type.
 */
export function classifyQuestion(question = "") {

    const q = question.toLowerCase().trim();

    // -----------------------------
    // Self Introduction
    // -----------------------------
    if (
        q === "introduce yourself" ||
        q === "tell me about yourself" ||
        q.includes("introduce yourself") ||
        q.includes("tell me about yourself") ||
        q.includes("briefly introduce yourself") ||
        q.includes("can you introduce yourself") ||
        q.includes("walk me through your resume") ||
        q.includes("walk me through resume") ||
        q.includes("self introduction") ||
        q.includes("about yourself") ||
        q.includes("your background")
    ) {
        return "SELF_INTRO";
    }

    // -----------------------------
    // Architecture / System Design
    // -----------------------------
    if (
        q.includes("project architecture") ||
        q.includes("application architecture") ||
        q.includes("system architecture") ||
        q.includes("overall architecture") ||
        q.includes("microservices architecture") ||
        q.includes("deployment architecture") ||
        q.includes("project design") ||
        q.includes("system design") ||
        q.includes("design the system") ||
        q.includes("design a system") ||
        q.includes("request flow") ||
        q.includes("application flow") ||
        q.includes("project flow") ||
        q.includes("workflow") ||
        q.includes("authentication flow") ||
        q.includes("authorization flow") ||
        q.includes("api flow") ||
        q.includes("database flow") ||
        q.includes("end to end flow") ||
        q.includes("draw architecture") ||
        q.includes("draw the architecture") ||
        q.includes("sequence diagram") ||
        q.includes("high level design") ||
        q.includes("low level design")
    ) {
        return "ARCHITECTURE";
    }

    // -----------------------------
    // Scenario Questions
    // -----------------------------
    if (
        q.includes("tell me about a time") ||
        q.includes("have you ever") ||
        q.includes("how did you handle") ||
        q.includes("what would you do") ||
        q.includes("production issue") ||
        q.includes("production support") ||
        q.includes("bug") ||
        q.includes("issue") ||
        q.includes("incident") ||
        q.includes("challenge") ||
        q.includes("debug") ||
        q.includes("merge conflict") ||
        q.includes("deadline") ||
        q.includes("performance issue") ||
        q.includes("memory issue") ||
        q.includes("slow api") ||
        q.includes("customer issue") ||
        q.includes("client issue") ||
        q.includes("team conflict") ||
        q.includes("code review")
    ) {
        return "SCENARIO";
    }

    // -----------------------------
    // Coding Questions
    // -----------------------------
    if (

        // Generic
        q.includes("write code") ||
        q.includes("write a program") ||
        q.includes("coding") ||
        q.includes("algorithm") ||
        q.includes("implement") ||
        q.includes("logic") ||
        q.includes("solution") ||

        // Languages
        q.includes("java") ||
        q.includes("python") ||
        q.includes("javascript") ||
        q.includes("typescript") ||
        q.includes("c++") ||
        q.includes("c#") ||
        q.includes("sql query") ||

        // DSA
        q.includes("array") ||
        q.includes("string") ||
        q.includes("linked list") ||
        q.includes("stack") ||
        q.includes("queue") ||
        q.includes("tree") ||
        q.includes("graph") ||
        q.includes("heap") ||
        q.includes("hashmap") ||
        q.includes("hashset") ||
        q.includes("binary search") ||
        q.includes("recursion") ||
        q.includes("dynamic programming") ||
        q.includes("sliding window") ||
        q.includes("two pointer") ||

        // Common Programs
        q.includes("reverse string") ||
        q.includes("palindrome") ||
        q.includes("anagram") ||
        q.includes("duplicate") ||
        q.includes("fibonacci") ||
        q.includes("factorial") ||
        q.includes("prime") ||
        q.includes("second highest") ||
        q.includes("largest") ||
        q.includes("smallest") ||
        q.includes("sort") ||
        q.includes("search") ||
        q.includes("find") ||

        // Platforms
        q.includes("leetcode") ||
        q.includes("hackerrank") ||
        q.includes("coding round")
    ) {
        return "CODING";
    }

    // -----------------------------
    // Default
    // -----------------------------
    return "CONCEPT";
}