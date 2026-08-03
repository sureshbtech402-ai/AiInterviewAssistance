// utils/followupHandler.js

/**
 * Detect whether the current question is a follow-up
 * to the previous interview question.
 */

const FOLLOW_UP_PATTERNS = [

    // Why / How
    "why",
    "why is that",
    "how",
    "how so",
    "how does",
    "how did",
    "internally",

    // Explain
    "explain",
    "explain more",
    "explain again",
    "can you explain",
    "tell me more",
    "more",
    "elaborate",
    "can you elaborate",
    "deep dive",
    "go deeper",

    // Examples
    "example",
    "give an example",
    "show me",
    "real time example",
    "real-time example",

    // Comparison
    "difference",
    "compare",
    "which one",

    // Continuation
    "continue",
    "go on",
    "next",
    "after that",
    "then what",
    "what happens next",
    "walk me through",
    "flow",
    "step by step",

    // Usage
    "when should",
    "when would",
    "what about",
    "how about",
    "what if",

    // Coding Follow-ups
    "without recursion",
    "using recursion",
    "using hashmap",
    "using streams",
    "using java 8",

    // Misc
    "in simple words",
    "can you simplify",
    "briefly",
    "shortly",
    "one more thing",
    "is there any other way"

];

/**
 * Returns true if question is likely
 * a follow-up question.
 */
export function isFollowUpQuestion(question = "") {

    const q = question.toLowerCase().trim();

    if (!q) {
        return false;
    }

    return FOLLOW_UP_PATTERNS.some(pattern =>
        q.includes(pattern)
    );
}

/**
 * Builds previous conversation
 * for GPT.
 */
export function buildConversationHistory(history = []) {

    if (!Array.isArray(history) || history.length === 0) {
        return "";
    }

    return history
        .map(item => {

            const role =
                item.role === "assistant"
                    ? "Assistant"
                    : "User";

            return `${role}: ${item.content}`;

        })
        .join("\n\n");
}

/**
 * Creates a follow-up prompt.
 */
export function buildFollowUpPrompt({

    question,

    historyText

}) {

    return `

=============================
PREVIOUS CONVERSATION
=============================

${historyText}

=============================
FOLLOW-UP QUESTION
=============================

"${question}"

=============================
INSTRUCTIONS
=============================

The interviewer has asked a follow-up question.

• Continue exactly from the previous answer.

• Do NOT restart the topic.

• Do NOT repeat what has already been explained.

• Assume the interviewer already understood your previous answer.

• Answer only the new part being asked.

• If asked "Why", explain only the reason.

• If asked "How", explain only the implementation or process.

• If asked for an example, give one practical example.

• If asked for a comparison, compare only the requested concepts.

• Keep the conversation natural.

• Speak in simple Indian English.

• Sound like a real software engineer answering in a live interview.

`;
}