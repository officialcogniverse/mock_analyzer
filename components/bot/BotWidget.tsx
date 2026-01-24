"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function BotWidget() {
  const [mode, setMode] = React.useState("helper");
  const [message, setMessage] = React.useState("");
  const [messages, setMessages] = React.useState<Array<{ role: "user" | "bot"; text: string }>>(
    []
  );

  const handleSend = async () => {
    if (!message.trim()) return;
    const userMessage = message.trim();
    setMessage("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);

    const endpoint = mode === "helper" ? "/api/bot/feature-helper" : "/api/bot/ei";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage }),
    });
    const json = await res.json();
    if (json.ok) {
      const reply = mode === "helper" ? json.data.reply : json.data.insights?.[0];
      setMessages((prev) => [...prev, { role: "bot", text: reply || "" }]);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Coach bot</h2>
      </div>
      <Tabs value={mode} onValueChange={setMode} className="mt-4">
        <TabsList>
          <TabsTrigger value="helper">Helper</TabsTrigger>
          <TabsTrigger value="ei">EI</TabsTrigger>
        </TabsList>
        <TabsContent value="helper" />
        <TabsContent value="ei" />
      </Tabs>
      <div className="mt-4 space-y-2">
        {messages.map((msg, index) => (
          <div
            key={`${msg.role}-${index}`}
            className={`rounded-xl px-3 py-2 text-sm ${
              msg.role === "user"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {msg.text}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask about features or mindset"
        />
        <Button onClick={handleSend}>Send</Button>
      </div>
    </div>
  );
}
