"use client"

import { AlertTriangle, CalendarClock, Coins, Quote } from "lucide-react"
import type { ForecastResponse } from "@/lib/squeeze-data"
import { Panel, SectionLabel } from "./primitives"
import { AnimatedCurrency } from "./animated-currency"

export function GapDiagnosis({ forecast }: { forecast: ForecastResponse }) {
  const topOutflow = Math.max(...forecast.outflows.map((o) => o.amount))

  return (
    <div className="space-y-4">
      <Panel className="relative overflow-hidden p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-danger" />
          <SectionLabel>Why this gap exists</SectionLabel>
        </div>
        <div className="mt-4 flex gap-3">
          <Quote className="size-5 shrink-0 text-primary" />
          <p className="max-w-3xl text-pretty text-lg leading-relaxed text-foreground">
            Payroll lands <span className="text-danger">Thursday</span> before BrightBuild is expected to pay. Patel is
            late but predictable, so their <AnimatedCurrency value={680} className="inline" /> is safe. BrightBuild is the real risk: no payment history and{" "}
            <span className="text-danger">two reminders ignored</span> on a <AnimatedCurrency value={2400} className="inline" /> invoice that&apos;s{" "}
            <span className="text-danger">17 days overdue</span>.
          </p>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-6">
          <div className="flex items-center gap-2">
            <Coins className="size-4 text-warning" />
            <SectionLabel>Top outflows building pressure</SectionLabel>
          </div>
          <div className="mt-4 space-y-3">
            {forecast.outflows.map((o) => (
              <div key={o.label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-foreground">{o.label}</span>
                  <span className="font-mono tabular-nums text-foreground">
                    <AnimatedCurrency value={o.amount} />
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-danger/70"
                      style={{ width: `${(o.amount / topOutflow) * 100}%` }}
                    />
                  </div>
                  <span className="w-14 text-right text-[11px] uppercase tracking-wide text-muted-foreground">
                    {o.date}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" />
            <SectionLabel>Invoices arriving too late</SectionLabel>
          </div>
          <div className="mt-4 space-y-3">
            {forecast.gapDrivers.map((d) => (
              <div key={d.contact} className="rounded-xl border border-border bg-background/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{d.contact}</span>
                      {d.daysOverdue > 0 && (
                        <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">
                          {d.daysOverdue}d overdue
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{d.note}</p>
                  </div>
                  <div className="text-right">
                    <AnimatedCurrency value={d.amount} className="block font-mono text-sm tabular-nums text-foreground" />
                    <div className="text-[11px] text-muted-foreground">exp. {d.expectedDate}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
