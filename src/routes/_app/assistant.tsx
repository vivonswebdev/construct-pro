import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { Bot, Send, User2, Sparkles, Loader2 } from "lucide-react";
import { askAssistant } from "@/lib/assistant.functions";
import { useTranslation } from "react-i18next";
import { isLangue } from "@/lib/i18n";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/_app/assistant")({
  component: AssistantPage,
  head: () => pageHead("assistant"),
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = ["budget", "quotes", "fleet", "deadlines"] as const;

function AssistantPage() {
  const { t, i18n } = useTranslation("assistant");
  const ask = useServerFn(askAssistant);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const langue = isLangue(i18n.language) ? i18n.language : "fr";
      const res = await ask({ data: { messages: next, langue } });
      setMessages([
        ...next,
        {
          role: "assistant",
          content: res.ok
            ? res.content || t("emptyAnswer")
            : `⚠️ ${t(`errors.${res.error}`, { status: res.status ?? "" })}`,
        },
      ]);
    } catch {
      setMessages([...next, { role: "assistant", content: `⚠️ ${t("errors.generic")}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-3rem)] max-w-4xl flex-col">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" />
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl bg-card p-5 shadow-sm">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
              <Bot className="h-7 w-7 text-primary" />
            </div>
            <p className="mb-5 max-w-md text-sm text-muted-foreground">{t("intro")}</p>
            <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(t(`suggestions.${s}`))}
                  className="rounded-xl border border-border px-4 py-3 text-left text-sm transition hover:border-primary hover:bg-accent"
                >
                  {t(`suggestions.${s}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.content}
              </div>
              {m.role === "user" && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <User2 className="h-4 w-4 text-primary" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("thinking")}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-4 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder={t("placeholder")}
          className="min-h-[46px] flex-1 resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-[46px] items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {t("send")}
        </button>
      </form>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("disclaimer")}</p>
    </div>
  );
}
