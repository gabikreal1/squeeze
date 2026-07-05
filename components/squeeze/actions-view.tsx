"use client"

import { useState } from "react"
import {
  ChevronDown,
  Lock,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import type { ForecastResponse, SqueezeAction } from "@/lib/squeeze-data"
import { gbp, pct } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Panel, SectionLabel, LevelDots, RiskTag } from "./primitives"
import { AnimatedCurrency } from "./animated-currency"

const LADDER = [
  "Watch",
  "Soft nudge",
  "Firm reminder",
  "AI phone call",
  "Early-pay discount",
  "Invoice financing",
  "Letter Before Action",
]

export function ActionsView({
  forecast,
  onApproveCall,
  callStates,
  onSendMessage,
  messageStates,
}: {
  forecast: ForecastResponse
  onApproveCall: (action: SqueezeAction) => void
  callStates: Record<string, "idle" | "calling" | "done">
  onSendMessage: (action: SqueezeAction) => void
  messageStates: Record<string, "idle" | "sending" | "sent" | "error">
}) {
  return (
    <div className="space-y-4">
      <Panel className="p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <SectionLabel>The escalation ladder</SectionLabel>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Squeeze escalates proportionately — it starts gentle and only climbs when behaviour and risk justify it. Serious
          rungs need your approval.
        </p>
        <div className="mt-5 flex flex-wrap items-stretch gap-2">
          {LADDER.map((step, i) => (
            <div
              key={step}
              className={cn(
                "flex flex-1 min-w-[110px] flex-col gap-1 rounded-xl border p-3",
                i >= 5
                  ? "border-danger/25 bg-danger/5"
                  : i >= 3
                    ? "border-warning/25 bg-warning/5"
                    : "border-border bg-background/40",
              )}
            >
              <span className="font-mono text-[11px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-sm font-medium text-foreground">{step}</span>
              {i >= 3 && (
                <span className="mt-auto flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <Lock className="size-3" /> approval
                </span>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {forecast.actions.map((a) => (
          <CustomerCard
            key={a.id}
            action={a}
            onApproveCall={() => onApproveCall(a)}
            callState={callStates[a.id] ?? "idle"}
            paymentAmount={forecast.paymentReceived ?? a.invoiceAmount}
            onSendMessage={onSendMessage}
            messageState={messageStates[a.id] ?? "idle"}
          />
        ))}
      </div>
    </div>
  )
}

function CustomerCard({
  action,
  onApproveCall,
  callState,
  paymentAmount,
  onSendMessage,
  messageState,
}: {
  action: SqueezeAction
  onApproveCall: () => void
  callState: "idle" | "calling" | "done"
  paymentAmount: number
  onSendMessage: (action: SqueezeAction) => void
  messageState: "idle" | "sending" | "sent" | "error"
}) {
  const [open, setOpen] = useState(false)
  const isCall = action.actionLabel === "AI call"

  const accentRing =
    action.accent === "danger"
      ? "border-danger/40"
      : action.accent === "lemon"
        ? "border-primary/40"
        : "border-border"

  return (
    <Panel
      className={cn(
        "flex flex-col overflow-hidden p-0 transition",
        accentRing,
      )}
    >
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">{action.customer}</h3>
            <RiskTag level={action.riskClass} />
            {action.dontSqueeze && (
              <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                Don&apos;t squeeze
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{action.summary}</p>
        </div>
        <div className="shrink-0 text-right">
          <AnimatedCurrency
            value={action.invoiceAmount}
            className="block font-mono text-lg tabular-nums text-foreground"
          />
          <div className="text-[11px] text-muted-foreground">{action.invoiceNumber}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border px-5 py-4 sm:grid-cols-4">
        <Field label="Overdue" value={action.daysOverdue > 0 ? `${action.daysOverdue} days` : "On time"} danger={action.daysOverdue > 10} />
        <Field label="Expected" value={action.expectedDate} />
        <Field label="Pattern" value={action.paymentPattern} span />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-background/30 px-5 py-3 text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">Speed <LevelDots level={action.speed} /></span>
          <span className="flex items-center gap-1.5 text-muted-foreground">Cost <LevelDots level={action.cost} invert /></span>
          <span className="flex items-center gap-1.5 text-muted-foreground">Risk <LevelDots level={action.relationshipRisk} invert /></span>
        </div>
        <span className="font-mono text-muted-foreground">{pct(action.confidence)} conf.</span>
      </div>

      {/* recommendation + primary action */}
      <div className="mt-auto border-t border-border p-5">
        <div className="flex items-center gap-2">
          <SectionLabel>Squeeze recommends</SectionLabel>
        </div>
        <p className="mt-1 text-sm font-medium text-foreground">{action.recommendation}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isCall ? (
            <div className="flex flex-col items-start gap-1">
              <CallButton state={callState} onApprove={onApproveCall} amount={paymentAmount} />
              {action.contactPhone && (
                <span className="font-mono text-[10px] text-muted-foreground">→ {action.contactPhone}</span>
              )}
            </div>
          ) : action.messageRung ? (
            <MessageButton
              state={messageState}
              label={action.actionLabel ?? "Send WhatsApp"}
              phone={action.contactPhone}
              onSend={() => onSendMessage(action)}
              soft={Boolean(action.dontSqueeze)}
            />
          ) : action.actionLabel ? (
            <button className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent">
              <ShieldCheck className="size-4 text-success" /> {action.actionLabel}
            </button>
          ) : null}
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"
            aria-expanded={open}
          >
            Why & alternatives
            <ChevronDown className={cn("size-3.5 transition", open && "rotate-180")} />
          </button>
        </div>

        {open && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <div>
              <SectionLabel>Reasoning</SectionLabel>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{action.reasoning}</p>
            </div>
            <div>
              <SectionLabel>Alternatives on the ladder</SectionLabel>
              <div className="mt-2 space-y-1.5">
                {action.ladder.map((step) => (
                  <div
                    key={step.rung}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2 text-xs",
                      step.recommended ? "border-primary/40 bg-primary/5" : "border-border",
                    )}
                  >
                    <span className="font-mono text-muted-foreground">{String(step.rung).padStart(2, "0")}</span>
                    <span className="min-w-[92px] font-medium text-foreground">{step.name}</span>
                    <span className="flex-1 text-muted-foreground">{step.note}</span>
                    {step.recommended && <span className="text-[10px] font-semibold uppercase text-primary">Chosen</span>}
                    {step.requiresApproval && !step.recommended && <Lock className="size-3 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}

function Field({ label, value, danger, span }: { label: string; value: string; danger?: boolean; span?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-0.5", span && "col-span-2")}>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-medium", danger ? "text-danger" : "text-foreground")}>{value}</span>
    </div>
  )
}

function CallButton({ state, onApprove, amount }: { state: "idle" | "calling" | "done"; onApprove: () => void; amount: number }) {
  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-2 text-sm font-semibold text-success">
        <ShieldCheck className="size-4" /> Paid · {gbp(amount)} received
      </span>
    )
  }
  if (state === "calling") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
        <PhoneCall className="size-4 animate-pulse" /> AI call in progress…
      </span>
    )
  }
  return (
    <button
      onClick={onApprove}
      className="inline-flex items-center gap-2 rounded-full bg-danger px-4 py-2 text-sm font-semibold text-danger-foreground transition hover:opacity-90"
    >
      <PhoneCall className="size-4" /> Approve AI call
    </button>
  )
}

function MessageButton({
  state,
  label,
  phone,
  onSend,
  soft,
}: {
  state: "idle" | "sending" | "sent" | "error"
  label: string
  phone?: string
  onSend: () => void
  soft?: boolean
}) {
  if (state === "sent") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-2 text-sm font-semibold text-success">
        <MessageCircle className="size-4" /> WhatsApp sent
      </span>
    )
  }
  if (state === "sending") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
        <MessageCircle className="size-4 animate-pulse" /> Sending…
      </span>
    )
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onSend}
        disabled={state === "error" || !phone}
        title={phone ? undefined : "Add a mobile number to this contact in Xero"}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50",
          soft
            ? "border border-success/30 bg-success/10 text-success"
            : "bg-primary text-primary-foreground",
        )}
      >
        <MessageCircle className="size-4" /> {label}
      </button>
      {phone && (
        <span className="font-mono text-[10px] text-muted-foreground">→ {phone}</span>
      )}
    </div>
  )
}
