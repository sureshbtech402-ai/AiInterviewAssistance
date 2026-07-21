const MAX_HISTORY = 20;

const historyStore = new Map();

function getOrCreateHistory(sessionId) {
  if (!historyStore.has(sessionId)) {
    historyStore.set(sessionId, []);
  }

  return historyStore.get(sessionId);
}

export function addUserMessage(sessionId, message) {
  if (!sessionId || !message?.trim()) return;

  const history = getOrCreateHistory(sessionId);

  history.push({
    role: "user",
    content: message.trim()
  });

  trimHistory(history);
}

export function addAssistantMessage(sessionId, message) {
  if (!sessionId || !message?.trim()) return;

  const history = getOrCreateHistory(sessionId);

  history.push({
    role: "assistant",
    content: message.trim()
  });

  trimHistory(history);
}

export function getHistory(sessionId, limit = 8) {
  if (!sessionId) return [];

  const history = getOrCreateHistory(sessionId);

  return history.slice(-limit);
}

export function clearHistory(sessionId) {
  if (!sessionId) return;

  historyStore.delete(sessionId);
}

function trimHistory(history) {
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

export function getAllHistory() {
  return historyStore;
}