const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function askOpenAI(messages, options = {}) {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: options.responseFormat
        ? { type: options.responseFormat }
        : undefined,
      temperature: options.temperature ?? 0.2,
      max_completion_tokens: options.maxTokens ?? 1500,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("OpenAI Error:", data);
    throw new Error(data?.error?.message || "OpenAI Request Failed");
  }

  return data?.choices?.[0]?.message?.content || "";
}

export async function streamOpenAI(messages, res) {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      temperature: 0.25,
      max_completion_tokens: 800,
    }),
  });

  if (!response.ok || !response.body) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.body;
}