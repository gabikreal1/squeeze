"use client"

import type { ReactNode } from "react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"
import { TrendingUp } from "lucide-react"
import { businessHealth as h } from "@/lib/squeeze-data"
import { cn } from "@/lib/utils"
import { Panel, SectionLabel } from "./primitives"
import { AnimatedCurrency } from "./animated-currency"
import CountUp from "@/components/CountUp"

const concentrationColors = ["var(--chart-2)", "var(--chart-1)", "var(--chart-4)", "var(--chart-3)", "var(--chart-5)"]

export function HealthView() {
  const dsoData = h.dsoTrend.map((v, i) => ({ i, v }))
  const maxLate = Math.max(...h.lateByValue.map((l) => l.amount))
  const pnl = h.pnl

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Revenue expected (mo)" value={<AnimatedCurrency value={h.revenueExpected} />} />
        <KpiCard label="Receivables out" value={<AnimatedCurrency value={h.receivablesOutstanding} />} />
        <KpiCard label="Payables upcoming" value={<AnimatedCurrency value={h.payablesUpcoming} />} />
        <KpiCard
          label="Payroll coverage"
          value={
            <span>
              <CountUp to={h.payrollCoverageDays} /> days
            </span>
          }
          tone="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* DSO */}
        <Panel className="p-6">
          <div className="flex items-center justify-between">
            <SectionLabel>Days sales outstanding</SectionLabel>
            <span className="flex items-center gap-1 text-xs text-danger">
              <TrendingUp className="size-3.5" /> rising
            </span>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="font-mono text-3xl tabular-nums text-foreground">
              <CountUp to={h.dsoCurrent} />
            </span>
            <span className="mb-1 text-xs text-muted-foreground">days avg to pay</span>
          </div>
          <div className="mt-2 h-16 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dsoData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--danger)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--danger)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="var(--danger)" strokeWidth={2} fill="url(#dso)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* concentration */}
        <Panel className="p-6">
          <SectionLabel>Customer concentration</SectionLabel>
          <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full">
            {h.customerConcentration.map((c, i) => (
              <div
                key={c.name}
                style={{ width: `${c.pct}%`, background: concentrationColors[i] }}
                title={`${c.name} ${c.pct}%`}
              />
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {h.customerConcentration.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: concentrationColors[i] }} />
                <span className="flex-1 text-muted-foreground">{c.name}</span>
                <span className="font-mono tabular-nums text-foreground">
                  <CountUp to={c.pct} />%
                </span>
              </div>
            ))}
          </div>
        </Panel>

        {/* late by value */}
        <Panel className="p-6">
          <SectionLabel>Late invoices by value</SectionLabel>
          <div className="mt-4 space-y-4">
            {h.lateByValue.map((l) => (
              <div key={l.name}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-foreground">{l.name}</span>
                  <AnimatedCurrency value={l.amount} className="font-mono tabular-nums text-foreground" />
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-warning/70" style={{ width: `${(l.amount / maxLate) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* P&L snapshot */}
      <Panel className="p-6">
        <SectionLabel>P&amp;L snapshot · this month</SectionLabel>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <PnlItem label="Revenue" value={pnl.revenue} tone="good" />
          <PnlItem label="Supplier costs" value={-pnl.supplierCosts} />
          <PnlItem label="Payroll" value={-pnl.payroll} />
          <PnlItem label="Operating exp." value={-pnl.operatingExpenses} />
          <PnlItem label="Net cash movement" value={pnl.netCashMovement} tone="good" emphasize />
        </div>
      </Panel>
    </div>
  )
}

function KpiCard({ label, value, tone }: { label: string; value: ReactNode; tone?: "warning" }) {
  return (
    <Panel className="p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-2 font-mono text-2xl tabular-nums", tone === "warning" ? "text-warning" : "text-foreground")}>
        {value}
      </div>
    </Panel>
  )
}

function PnlItem({
  label,
  value,
  tone,
  emphasize,
}: {
  label: string
  value: number
  tone?: "good"
  emphasize?: boolean
}) {
  return (
    <div className={cn("rounded-xl border p-4", emphasize ? "border-success/30 bg-success/5" : "border-border bg-background/40")}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <AnimatedCurrency
        value={value}
        showPlus={value > 0 && emphasize}
        className={cn(
          "mt-1 block font-mono text-lg tabular-nums",
          value < 0 ? "text-danger" : tone === "good" ? "text-success" : "text-foreground",
        )}
      />
    </div>
  )
}
