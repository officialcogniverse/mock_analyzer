"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ChatMessage = {
  role: "user" | "bot";
  text: string;
  timestamp: string;
  payload?: {
    matches?: Array<{
      name: string;
      description: string;
      route: string;
      howTo: string[];
    }>;
    suggestions?: string[];
    ei?: {
      insights: string[];
      controllableFactors: string[];
      uncontrollableFactors: string[];
      nextSteps: string[];
      frictionSignals: string[];
    };
  };
};

const helperSeed: ChatMessage = {
  role: "bot",
  text: "Ask me where to find features, or how to use the analyzer.",
  timestamp: new Date().toISOString(),
};

const eiSeed: ChatMessage = {
  role: "bot",
  text: "Share how prep feels and I’ll suggest a grounded next step.",
  timestamp: new Date().toISOString(),
};

export function BotWidget() {
  const [mode, setMode] = React.useState<"helper" | "ei">("helper");
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [messagesByMode, setMessagesByMode] = React.useState<Record<"helper" | "ei", ChatMessage[]>>({
    helper: [helperSeed],
    ei: [eiSeed],
  });
  const [sending, setSending] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const handler = () => setOpen(true);
    if (typeof window !== "undefined") {
      window.addEventListener("open-bot-widget", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("open-bot-widget", handler);
      }
    };
  }, []);

  const messages = messagesByMode[mode];

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    const userMessage = message.trim();
    setMessage("");
    setSending(true);
    setMessagesByMode((prev) => ({
      ...prev,
      [mode]: [...prev[mode], { role: "user", text: userMessage, timestamp: new Date().toISOString() }],
    }));

    try {
      const endpoint = mode === "helper" ? "/api/bot/feature-helper" : "/api/bot/ei";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const json = await res.json();
      if (json.ok) {
        if (mode === "helper") {
          setMessagesByMode((prev) => ({
            ...prev,
            [mode]: [
              ...prev[mode],
              {
                role: "bot",
                text: json.data.reply,
                timestamp: new Date().toISOString(),
                payload: {
                  matches: json.data.matches,
                  suggestions: json.data.suggestions,
                },
              },
            ],
          }));
        } else {
          const data = json.data;
          setMessagesByMode((prev) => ({
            ...prev,
            [mode]: [
              ...prev[mode],
              {
                role: "bot",
                text: data.insights?.[0] || "Here’s a grounded next step for today.",
                timestamp: new Date().toISOString(),
                payload: {
                  ei: data,
                },
              },
            ],
          }));
        }
      } else {
        setMessagesByMode((prev) => ({
          ...prev,
          [mode]: [
            ...prev[mode],
            {
              role: "bot",
              text: json.error?.message || "I couldn’t respond. Please try again.",
              timestamp: new Date().toISOString(),
            },
          ],
        }));
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="w-[320px] rounded-3xl border border-border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Coach bots</p>
              <p className="text-xs text-muted-foreground">Helper + EI in one place</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
          <div className="px-4 pt-3">
            <Tabs value={mode} onValueChange={(value) => setMode(value as "helper" | "ei")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="helper">Helper</TabsTrigger>
                <TabsTrigger value="ei">EI</TabsTrigger>
              </TabsList>
              <TabsContent value="helper" />
              <TabsContent value="ei" />
            </Tabs>
          </div>
          <div ref={listRef} className="max-h-[300px] space-y-3 overflow-y-auto px-4 pb-4 pt-3">
            {messages.map((msg, index) => (
              <div
                key={`${msg.role}-${index}`}
                className={cn(
                  "rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <p>{msg.text}</p>
                {msg.payload?.matches?.length ? (
                  <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                    {msg.payload.matches.map((feature) => (
                      <div key={feature.name} className="rounded-lg border border-border/60 bg-background p-2">
                        <p className="text-sm font-medium text-foreground">{feature.name}</p>
                        <p>{feature.description}</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          {feature.howTo.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ul>
                        <Link href={feature.route} className="mt-2 inline-flex text-xs font-medium text-primary">
                          Open {feature.name}
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : null}
                {msg.payload?.suggestions?.length ? (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Try asking:</p>
                    <ul className="list-disc pl-4">
                      {msg.payload.suggestions.map((suggestion) => (
                        <li key={suggestion}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {msg.payload?.ei ? (
                  <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                    <div>
                      <p className="font-medium text-foreground">Insights</p>
                      <ul className="list-disc pl-4">
                        {msg.payload.ei.insights.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Next steps</p>
                      <ul className="list-disc pl-4">
                        {msg.payload.ei.nextSteps.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    {msg.payload.ei.frictionSignals.length ? (
                      <div className="flex flex-wrap gap-1">
                        {msg.payload.ei.frictionSignals.map((signal) => (
                          <span key={signal} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                            {signal}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="border-t border-border/60 p-3">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={mode === "helper" ? "Ask about features" : "Share how prep feels"}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSend();
                }}
              />
              <Button onClick={handleSend} disabled={sending}>
                {sending ? "..." : "Send"}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              EI bot is not a therapist and does not provide medical advice.
            </p>
          </div>
        </div>
      ) : null}
      <Button
        className="mt-4 h-12 w-12 rounded-full shadow-lg"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open coach bots"
      >
        {open ? "×" : "Help"}
      </Button>
    </div>
  );
}
