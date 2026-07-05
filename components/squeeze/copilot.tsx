"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUp, Loader2, Sparkles, Wrench, X } from "lucide-react"
import type { ApiForecastResponse } from "@/lib/api/format-forecast"
import { suggestedPrompts } from "@/lib/squeeze-data"
import { cn } from "@/lib/utils"
import { SectionLabel } from "./primitives"

type Msg = {
  role: "user" | "assistant"
  text: string
  tools?: string[]
}

type CopilotProps = {
  open: boolean
  onClose: () => void
  forecastContext: ApiForecastResponse | null
}

export function Copilot({ open, onClose, forecastContext }: CopilotProps) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState<boolean | null>(null)
  const lastGreetingRef = useRef("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    void fetch("/api/copilot/status")
      .then((r) => r.json())
      .then((d: { ready: boolean }) => setReady(d.ready))
      .catch(() => setReady(false))
  }, [])

  useEffect(() => {
    if (!open || !forecastContext || ready === false) {
      if (open && ready === false) {
        setMessages([
          {
            role: "assistant",
            text: "Copilot is offline — add OPENAI_API_KEY to .env and restart the dev server.",
          },
        ])
      }
      return
    }
    if (ready !== true) return

    const key = `${forecastContext.source}-${forecastContext.safeToSpend}-${forecastContext.gapClosed}-${forecastContext.gap?.amount ?? 0}-${forecastContext.paymentReceived ?? 0}`
    if (lastGreetingRef.current === key) return
    lastGreetingRef.current = key

    setMessages([])
    setLoading(true)

    void fetch("/api/copilot/greeting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forecastContext }),
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          text?: string
          tools?: string[]
          error?: string
        }
        if (!response.ok) throw new Error(data.error ?? "Greeting failed")
        setMessages([
          {
            role: "assistant",
            text: data.text ?? "Morning — ask me about your cash position.",
            tools: data.tools,
          },
        ])
      })
      .catch((err) => {
        setMessages([
          {
            role: "assistant",
            text:
              err instanceof Error
                ? err.message
                : "Could not load briefing. Try asking a question below.",
          },
        ])
      })
      .finally(() => setLoading(false))
  }, [open, forecastContext, ready])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || loading || !forecastContext || ready === false) return

    const prior = messages.filter((m) => m.role === "user" || m.role === "assistant")
    const nextMessages: Msg[] = [...prior, { role: "user", text: q }]
    setMessages(nextMessages)
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, text: m.text })),
          forecastContext,
        }),
      })

      const data = (await response.json()) as { text?: string; tools?: string[]; error?: string }

      if (!response.ok) {
        throw new Error(data.error ?? "Copilot request failed")
      }

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: data.text ?? "I couldn't generate a response. Please try again.",
          tools: data.tools,
        },
      ])
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error"
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `Sorry — ${detail}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const dataLabel =
    forecastContext?.source === "xero" ? "Tool-backed · live Xero" : "Tool-backed · demo data"

  return (
    <aside
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-border bg-card/95 backdrop-blur-xl transition-transform duration-300",
        open ? "translate-x-0" : "translate-x-full",
      )}
      aria-hidden={!open}
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">Finance Copilot</div>
            <div className="text-[11px] text-muted-foreground">{dataLabel}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="Close copilot"
        >
          <X className="size-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && loading && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background/50 px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Reading your forecast…
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] space-y-2", m.role === "user" && "flex flex-col items-end")}>
              {m.tools && m.tools.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {m.tools.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                    >
                      <Wrench className="size-2.5" />
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background/50 text-foreground",
                )}
              >
                {m.text}
              </div>
            </div>
          </div>
        ))}
        {loading && messages.length > 0 && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background/50 px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Thinking…
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border px-4 py-3">
        <SectionLabel>Suggested</SectionLabel>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestedPrompts.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              disabled={loading || !forecastContext || ready === false}
              className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-40"
            >
              {p}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="mt-3 flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your cash…"
            disabled={loading || !forecastContext || ready === false}
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || !forecastContext || ready === false}
            className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40"
            aria-label="Send"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </form>
      </div>
    </aside>
  )
}
