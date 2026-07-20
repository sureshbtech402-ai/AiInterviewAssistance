// utils/followupHandler.js

/**
 * Detect whether the current question is a follow-up
 * to the previous interview question.
 */

const FOLLOW_UP_PATTERNS = [

    "why",

    "how",

    "how so",

    "how does",

    "how did",

    "explain more",

    "tell me more",

    "more",

    "elaborate",

    "can you elaborate",

    "can you explain",

    "give an example",

    "example",

    "real time example",

    "real-time example",

    "what do you mean",

    "difference",

    "compare",

    "which one",

    "when should",

    "when would",

    "then what",

    "after that",

    "next",

    "continue",

    "go on",

    "what happens next",

    "why is that",

    "can you simplify",

    "in simple words",

    "one more thing",

    "is there any other way"

];

/**
 * Returns true if question is likely
 * a follow-up question.
 */

export function isFollowUpQuestion(question = "") {

    const q = question.toLowerCase().trim();

    if (q.length <= 20) {
        return true;
    }

    return FOLLOW_UP_PATTERNS.some(pattern => q.includes(pattern));
}

/**
 * Builds previous conversation
 * for GPT.
 */

export function buildConversationHistory(history = []) {

    if (!Array.isArray(history)) {
        return "";
    }

    if (history.length === 0) {
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

Previous Conversation

${historyText}

=============================

The interviewer asked a follow-up question.

Current Question

"${question}"

Instructions

• Continue naturally.

• Do NOT repeat the previous answer.

• Assume the interviewer already understood your previous explanation.

• Add only the new information.

• If asked for an example,
give one example.

• If asked "why",
explain only the reason.

• If asked "how",
explain only the process.

• Keep continuity.

• Speak naturally.

• Sound like a real candidate.

`;
}