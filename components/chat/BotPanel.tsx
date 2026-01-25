"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const starterPrompts = [
  "I scored low. Motivate me and give me a plan.",
  "How do I improve accuracy without losing speed?",
  "I keep making careless errors. What should I fix first?",
];

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function BotPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hey! I’m your Motivation + Strategy Bot. Tell me about your mock score and how you feel. I’ll keep it short and actionable.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setInput("");
    setError(null);

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.ok) {
        setError(payload?.error?.message ?? "Bot unavailable. Try again soon.");
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: payload.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network issue. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="surface-card flex h-full flex-col gap-4 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">Motivation + Strategy Bot</p>
        <h3 className="mt-2 text-xl font-semibold">Stay locked in.</h3>
        <p className="text-sm text-muted-foreground">
          Talk through your score, mindset, and next steps. I’ll keep you moving.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {starterPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="rounded-full border border-primary/30 px-3 py-1 text-xs text-primary/90 transition hover:border-primary hover:text-primary"
            onClick={() => sendMessage(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border/70 bg-background/40 p-4 text-sm">
        {messages.map((message, idx) => (
          <div
            key={`${message.role}-${idx}`}
            className={
              message.role === "user"
                ? "ml-auto w-fit max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground"
                : "mr-auto w-fit max-w-[80%] rounded-2xl bg-card px-4 py-2 text-foreground"
            }
          >
            {message.content}
          </div>
        ))}
        {loading ? <p className="text-xs text-muted-foreground">Bot is typing...</p> : null}
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="space-y-2">
        <Textarea
          rows={3}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask for motivation or strategy..."
        />
        <Button type="button" onClick={() => sendMessage(input)} disabled={loading}>
          {loading ? "Sending..." : "Send"}
        </Button>
      </div>
    </aside>
  );
}
