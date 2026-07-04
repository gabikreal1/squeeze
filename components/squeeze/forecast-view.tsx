"use client"

import { Banknote, Calendar, FileInput, Receipt } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ForecastResponse, TimelinePoint } from "@/lib/squeeze-data"
import { gbp } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Panel, SectionLabel } from "./primitives"
import { CashCurve } from "./cash-curve"

const eventIcons: Record<string, LucideIcon> = {
  payroll: Banknote,
  vat: Receipt,
  supplier: FileInput,
  invoice: Calendar,
}

export function ForecastView({
  forecast,
  healed,
  ghostTimeline,
}: {
  forecast: ForecastResponse
  healed: boolean
  ghostTimeline?: TimelinePoint[]
}) {
  const events = forecast.timeline.filter((p) => p.event)

  return (
    <div className="space-y-4">
      <Panel className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionLabel>14-day projected balance</SectionLabel>
            <p className="mt-1 text-sm text-muted-foreground">
              {healed
                ? "Post-payment: the balance holds above the safe line every day."
                : "The curve dips below your safe line on Thursday — the shaded band is the danger zone."}
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <Legend swatch="var(--chart-1)" label="Projected balance" />
            <Legend swatch="var(--muted-foreground)" label="Safe line" dashed />
            <Legend swatch="var(--danger)" label="Gap zone" />
          </div>
        </div>
        <div className="mt-4">
          <CashCurve timeline={forecast.timeline} buffer={forecast.buffer} ghostTimeline={ghostTimeline} healed={healed} />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-6">
          <SectionLabel>Timeline events</SectionLabel>
          <div className="mt-4 space-y-2">
            {events.map((e) => {
              const Icon = eventIcons[e.event!.kind]
              const inflow = e.event!.kind === "invoice"
              return (
                <div key={e.label} className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg border",
                      inflow ? "border-success/25 bg-success/10 text-success" : "border-danger/25 bg-danger/10 text-danger",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{e.event!.label}</div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{e.label}</div>
                  </div>
                  <div className={cn("font-mono text-sm tabular-nums", inflow ? "text-success" : "text-danger")}>
                    {inflow ? gbp(e.event!.amount, { sign: true }) : `−${gbp(e.event!.amount).replace("£", "£")}`}
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel className="flex flex-col justify-between p-6">
          <div>
            <SectionLabel>Pressure reading</SectionLabel>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
              {healed ? (
                <>
                  Pressure released. With BrightBuild settled, inflows now stay ahead of every scheduled outflow across
                  the fortnight.
                </>
              ) : (
                <>
                  Pressure is building toward <span className="text-danger">Thursday</span>. Outflows of{" "}
                  <span className="text-foreground">{gbp(forecast.unpaidPayables)}</span> land before{" "}
                  <span className="text-foreground">{gbp(forecast.unpaidReceivables)}</span> of receivables clear.
                </>
              )}
            </p>
          </div>
          <div className="mt-5 flex items-center gap-4">
            <div
              className={cn(
                "relative flex size-24 items-center justify-center rounded-full border-4",
                healed ? "border-success/40" : "border-danger/40 animate-pulse-danger",
              )}
            >
              <span className={cn("font-mono text-lg tabular-nums", healed ? "text-success" : "text-danger")}>
                {healed ? "Low" : "High"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Cash-tension index
              <div className={cn("mt-1 font-mono text-2xl tabular-nums", healed ? "text-success" : "text-danger")}>
                {healed ? "22 / 100" : "81 / 100"}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Legend({ swatch, label, dashed }: { swatch: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      {dashed ? (
        <span className="h-px w-4 border-t-2 border-dashed" style={{ borderColor: swatch }} />
      ) : (
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: swatch }} />
      )}
      {label}
    </span>
  )
}
