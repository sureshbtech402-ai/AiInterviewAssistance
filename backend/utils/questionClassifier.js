// utils/questionClassifier.js

/**
 * Returns the interview question type.
 */
export function classifyQuestion(question = "") {

    const q = question.toLowerCase().trim();

    // -----------------------------
    // Self Introduction
    // -----------------------------
    if (
        q.includes("introduce yourself") ||
        q.includes("tell me about yourself") ||
        q.includes("walk me through your resume") ||
        q.includes("self introduction") ||
        q.includes("about yourself")
    ) {
        return "SELF_INTRO";
    }

    // -----------------------------
    // Architecture / System Design
    // -----------------------------
    if (
        q.includes("architecture") ||
        q.includes("system design") ||
        q.includes("request flow") ||
        q.includes("flow") ||
        q.includes("jwt") ||
        q.includes("oauth") ||
        q.includes("api gateway") ||
        q.includes("microservice") ||
        q.includes("microservices") ||
        q.includes("kafka") ||
        q.includes("redis") ||
        q.includes("rabbitmq") ||
        q.includes("load balancer") ||
        q.includes("sequence diagram")
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
        q.includes("bug") ||
        q.includes("challenge") ||
        q.includes("merge conflict") ||
        q.includes("deadline") ||
        q.includes("difficult situation") ||
        q.includes("team conflict") ||
        q.includes("slow api")
    ) {
        return "SCENARIO";
    }

    // -----------------------------
    // Coding Questions
    // -----------------------------
    if (
        q.includes("write a program") ||
        q.includes("write code") ||
        q.includes("coding") ||
        q.includes("java program") ||
        q.includes("sql query") ||
        q.includes("algorithm") ||
        q.includes("reverse string") ||
        q.includes("second highest") ||
        q.includes("duplicate") ||
        q.includes("binary search") ||
        q.includes("stream") ||
        q.includes("linked list") ||
        q.includes("array") ||
        q.includes("leetcode")
    ) {
        return "CODING";
    }

    // -----------------------------
    // Default
    // -----------------------------
    return "CONCEPT";
}