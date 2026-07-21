export function getCleanQuestion(question = "") {
  if (!question) return "";

  return question
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[؟]/g, "?")
    .trim();
}