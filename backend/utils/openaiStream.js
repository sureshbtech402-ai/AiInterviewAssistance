export async function pipeOpenAIStream(stream, res) {
  const decoder = new TextDecoder();
  let buffer = "";
  let completeAnswer = "";

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });

    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || "";

    for (const event of events) {
      const dataLine = event
        .split(/\r?\n/)
        .find((line) => line.startsWith("data:"));

      if (!dataLine) continue;

      const data = dataLine.slice(5).trim();

      if (data === "[DONE]") {
        res.end();
        return completeAnswer;
      }

      try {
        const payload = JSON.parse(data);
        const delta = payload?.choices?.[0]?.delta?.content || "";

        if (delta) {
          completeAnswer += delta;
          res.write(delta);
        }
      } catch (error) {
        console.error("OpenAI stream parse error:", error);
      }
    }
  }

  res.end();
  return completeAnswer;
}
