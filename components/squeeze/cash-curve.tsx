"use client"

import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { TimelinePoint } from "@/lib/squeeze-data"
import { gbp } from "@/lib/format"

type Row = TimelinePoint & { ghost?: number | null }

function EventTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Row }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="min-w-[180px] rounded-xl border border-border bg-popover/95 p-3 shadow-xl backdrop-blur">
      <div className="mb-1 flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-muted-foreground">{p.label}</span>
        {p.isLowDay && <span className="text-[10px] font-semibold uppercase tracking-wide text-danger">Low point</span>}
      </div>
      <div className="font-mono text-lg tabular-nums text-foreground">{gbp(p.balance)}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        Safe line {gbp(p.buffer)}
      </div>
      {p.inflow ? <div className="mt-1 text-[11px] text-success">Inflow {gbp(p.inflow, { sign: true })}</div> : null}
      {p.outflow ? <div className="text-[11px] text-danger">Outflow −{gbp(p.outflow).replace("£", "£")}</div> : null}
      {p.event ? (
        <div className="mt-2 border-t border-border pt-2 text-[11px] text-foreground">
          {p.event.label} · {gbp(p.event.amount)}
        </div>
      ) : null}
    </div>
  )
}

export function CashCurve({
  timeline,
  buffer,
  ghostTimeline,
  healed,
}: {
  timeline: TimelinePoint[]
  buffer: number
  ghostTimeline?: TimelinePoint[]
  healed?: boolean
}) {
  const data: Row[] = timeline.map((p, i) => ({
    ...p,
    ghost: ghostTimeline ? ghostTimeline[i]?.balance ?? null : null,
  }))
  const lowDay = timeline.find((p) => p.isLowDay)
  const maxBalance = Math.max(...timeline.map((p) => p.balance), buffer) * 1.15

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* danger zone below the safe line */}
          <ReferenceArea y1={0} y2={buffer} fill="var(--danger)" fillOpacity={healed ? 0.04 : 0.1} strokeOpacity={0} />

          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, maxBalance]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => gbp(v as number)}
            width={56}
          />
          <Tooltip content={<EventTooltip />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: 3 }} />

          <ReferenceLine
            y={buffer}
            stroke="var(--muted-foreground)"
            strokeDasharray="5 4"
            label={{ value: "Safe line", position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 10 }}
          />

          {/* ghost = the previous (pre-heal) curve */}
          {ghostTimeline && (
            <Line
              type="monotone"
              dataKey="ghost"
              stroke="var(--muted-foreground)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}

          <Area
            type="monotone"
            dataKey="balance"
            stroke={healed ? "var(--success)" : "var(--chart-1)"}
            strokeWidth={2.5}
            fill="url(#balanceFill)"
            animationDuration={1100}
            dot={(props: { cx?: number; cy?: number; payload?: Row; index?: number }) => {
              const { cx, cy, payload, index } = props
              if (cx == null || cy == null) return <g key={index} />
              if (payload?.event) {
                const color =
                  payload.event.kind === "invoice"
                    ? "var(--success)"
                    : payload.event.kind === "payroll"
                      ? "var(--danger)"
                      : "var(--warning)"
                return (
                  <g key={index}>
                    <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="var(--background)" strokeWidth={2} />
                  </g>
                )
              }
              return <g key={index} />
            }}
          />

          {lowDay && !healed && (
            <ReferenceDot
              x={lowDay.label}
              y={lowDay.balance}
              r={6}
              fill="var(--danger)"
              stroke="var(--background)"
              strokeWidth={2}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
