"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUp, Sparkles, Wrench, X } from "lucide-react"
import { suggestedPrompts } from "@/lib/squeeze-data"
import { cn } from "@/lib/utils"
import { SectionLabel } from "./primitives"

type Msg = {
  role: "user" | "assistant"
  text: string
  tools?: string[]
}

const KB: { match: RegExp; tools: string[]; answer: string }[] = [
  {
    match: /negative|safe.?to.?spend|why.*gap|explain.*forecast/i,
    tools: ["read_bank_balance", "project_cashflow(14d)", "diff(inflows, outflows)"],
    answer:
      "Safe-to-spend is −£1,180 because payroll (£1,470) clears on Thursday before your overdue invoices arrive. Your balance dips to £320 against a £1,500 safety buffer — a £1,180 shortfall. On paper you're fine (£8,180 owed vs £1,980 due); it's purely a timing gap.",
  },
  {
    match: /patel/i,
    tools: ["get_customer(Patel)", "payment_history", "risk_score"],
    answer:
      "Patel has paid 6 of 6 invoices, reliably ~8 days late. Their £680 is predicted to land Mon 8 either way. Chasing a trusted, high-value account for on-schedule cash only risks the relationship — so Squeeze holds. Do-not-squeeze logic applies.",
  },
  {
    match: /brightbuild.*today|if brightbuild|brightbuild pays/i,
    tools: ["simulate(payment=2400)", "reproject_cashflow"],
    answer:
      "If BrightBuild pays £2,400 today, the whole curve lifts above the safe line. Safe-to-spend flips from −£1,180 to +£1,220 and Thursday's gap closes entirely. That's why the AI call is the recommended plan.",
  },
  {
    match: /delay.*payroll|delay payroll/i,
    tools: ["what_if(defer=payroll)", "compliance_check"],
    answer:
      "Delaying payroll would close the gap on paper, but it's the one outflow Squeeze won't recommend touching — late wages carry legal and trust risk. Better options: an AI call to BrightBuild (free) or financing Newline's invoice (£76 fee).",
  },
  {
    match: /discount|2%|early payment/i,
    tools: ["model_discount(2%)", "margin_impact"],
    answer:
      "A 2% early-pay discount on BrightBuild's £2,400 costs you £48 and could pull cash in within 1–2 days, lifting safe-to-spend to about +£980. It's cheaper than financing but slower and less certain than the AI call.",
  },
  {
    match: /financing.*call|call.*financing|compare/i,
    tools: ["compare(planA, planC)"],
    answer:
      "Calling BrightBuild: free, same-day, 78% confidence. Financing Newline: £76 fee, same-day, 88% confidence but costs margin. Squeeze recommends the call first and keeps financing as the fallback if it doesn't land by Wednesday.",
  },
  {
    match: /draft|reminder|write/i,
    tools: ["draft_message(firm)", "tone_check"],
    answer:
      '"Hi BrightBuild team — invoice INV-2041 for £2,400 is now 17 days overdue. We\'ve not had a response to our previous notes. Could you confirm a payment date this week? Happy to help if there\'s a query on the invoice." Want me to escalate to a call instead?',
  },
  {
    match: /changed|yesterday/i,
    tools: ["diff(snapshot, -1d)"],
    answer:
      "Since yesterday: BrightBuild ticked to 17 days overdue and ignored a second reminder, nudging it to high-risk. Riverside's average days-to-pay crept from 44 to 46. Everything else is stable.",
  },
  {
    match: /fastest|close the gap/i,
    tools: ["rank_plans(by=speed)"],
    answer:
      "Fastest route: approve the AI call to BrightBuild. Same-day cash, no fee, and it alone closes the £1,180 gap. Financing Newline is equally fast but costs £76. I'd start with the call.",
  },
  {
    match: /protect|relationship/i,
    tools: ["rank_plans(by=relationship_risk)"],
    answer:
      "To protect relationships: hold on Patel entirely, and use a warm soft-nudge for Riverside rather than a firm reminder. BrightBuild has no relationship to protect (first-time, unresponsive), so it's safe to escalate there.",
  },
]

function respond(q: string): Msg {
  const hit = KB.find((k) => k.match.test(q))
  if (hit) return { role: "assistant", text: hit.answer, tools: hit.tools }
  return {
    role: "assistant",
    text: "I can explain the forecast, compare plans, or draft messages. Try one of the suggested prompts below — every answer is backed by your live Xero data.",
    tools: ["semantic_search(xero)"],
  }
}

export function Copilot({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Morning, Maya. I've reviewed your Xero data. There's a £1,180 cash gap on Thursday — ask me anything, or tap a prompt below.",
      tools: ["sync_xero", "project_cashflow(14d)"],
    },
  ])
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const send = (text: string) => {
    const q = text.trim()
    if (!q) return
    setMessages((m) => [...m, { role: "user", text: q }])
    setInput("")
    setTimeout(() => setMessages((m) => [...m, respond(q)]), 350)
  }

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
            <div className="text-[11px] text-muted-foreground">Tool-backed · live Xero</div>
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
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] space-y-2", m.role === "user" && "flex flex-col items-end")}>
              {m.tools && (
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
      </div>

      <div className="border-t border-border px-4 py-3">
        <SectionLabel>Suggested</SectionLabel>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestedPrompts.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
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
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp className="size-4" />
          </button>
        </form>
      </div>
    </aside>
  )
}
