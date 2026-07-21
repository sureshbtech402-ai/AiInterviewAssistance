export async function pipeOpenAIStream(stream, res) {
  const decoder = new TextDecoder();

  let buffer = "";

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      const line = event
        .split("\n")
        .find((l) => l.startsWith("data:"));

      if (!line) continue;

      const data = line.replace("data:", "").trim();

      if (data === "[DONE]") {
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      try {
        const json = JSON.parse(data);

        const delta =
          json?.choices?.[0]?.delta?.content || "";

        if (delta) {
          res.write(
            `data: ${JSON.stringify({
              text: delta,
            })}\n\n`
          );
        }
      } catch (err) {
        console.error("Stream Parse Error:", err);
      }
    }
  }

  res.write("data: [DONE]\n\n");
  res.end();
}