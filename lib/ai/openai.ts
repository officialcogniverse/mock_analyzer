export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export async function callOpenAiChat(messages: ChatMessage[], options: ChatOptions = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_KEY_MISSING");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? "gpt-4o-mini",
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 900,
      messages,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OPENAI_REQUEST_FAILED:${res.status}:${detail}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }

  return content;
}
