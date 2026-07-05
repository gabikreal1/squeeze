"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Check, Lock, X } from "lucide-react"
import type { ForecastResponse, Scenario } from "@/lib/squeeze-data"
import {
  buildScenariosFromForecast,
  pickDefaultScenarioId,
} from "@/lib/plan/build-scenarios"
import { pct } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Panel, SectionLabel, LevelDots } from "./primitives"
import { AnimatedCurrency } from "./animated-currency"

export function ScenariosView({
  forecast,
  healed,
}: {
  forecast: ForecastResponse
  healed: boolean
}) {
  const scenarios = useMemo(
    () => buildScenariosFromForecast(forecast),
    [forecast],
  )
  const [selected, setSelected] = useState(() =>
    pickDefaultScenarioId(scenarios, healed),
  )

  useEffect(() => {
    setSelected(pickDefaultScenarioId(scenarios, healed))
  }, [scenarios, healed])

  const active = scenarios.find((s) => s.id === selected) ?? scenarios[0]

  return (
    <div className="space-y-4">
      <Panel className="p-6">
        <SectionLabel>What-if planning</SectionLabel>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {healed
            ? "Gap closed — plans reflect your updated cash position after payment."
            : "Compare strategies side by side. Each plan is scored on the cash it frees, its cost, and the risk it puts on your customer relationships."}
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          {scenarios.map((s) => (
            <ScenarioCard key={s.id} scenario={s} selected={s.id === selected} onSelect={() => setSelected(s.id)} />
          ))}
        </div>

        <Panel
          className={cn(
            "h-fit p-6",
            active.recommended && "ring-1 ring-foreground/20",
            healed && active.id === "a" && "ring-1 ring-success/40",
          )}
        >
          <ScenarioDetail active={active} healed={healed} />
        </Panel>
      </div>
    </div>
  )
}

function ScenarioDetail({ active, healed }: { active: Scenario; healed: boolean }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <SectionLabel>{active.tag} · detail</SectionLabel>
        {active.recommended && !healed && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            Recommended
          </span>
        )}
        {healed && active.id === "a" && (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
            Completed
          </span>
        )}
      </div>
      <h3 className="mt-2 text-lg font-semibold text-foreground">{active.name}</h3>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat
          label="Safe-to-spend after"
          value={<AnimatedCurrency value={active.safeToSpend} />}
          tone={active.safeToSpend >= 0 ? "good" : "bad"}
        />
        <Stat label="Gap" value={active.gapClosed ? "Closed" : "Open"} tone={active.gapClosed ? "good" : "bad"} />
        <Stat label="Cost" value={active.cost === 0 ? "Free" : <AnimatedCurrency value={active.cost} />} />
        <Stat label="Time to cash" value={active.timeToCash} />
        <Stat label="Confidence" value={pct(active.confidence)} />
        <Stat label="Approval" value={active.requiresApproval ? "Required" : "Not needed"} />
      </div>

      <div className="mt-5">
        <SectionLabel>Operational steps</SectionLabel>
        <ol className="mt-2 space-y-1.5">
          {active.steps.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className="font-mono text-xs text-primary">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <button
        disabled={!active.gapClosed && !active.recommended}
        className={cn(
          "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50",
          active.gapClosed
            ? "bg-success/15 text-success"
            : active.recommended
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-background text-muted-foreground",
        )}
      >
        {active.requiresApproval && !active.gapClosed && <Lock className="size-3.5" />}
        {active.gapClosed
          ? healed && active.id === "a"
            ? "Plan executed — gap closed"
            : "Gap closed"
          : active.recommended
            ? `Run ${active.tag}`
            : "Not recommended"}
      </button>
    </>
  )
}

function ScenarioCard({
  scenario,
  selected,
  onSelect,
}: {
  scenario: Scenario
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition",
        "light:shadow-[0_1px_3px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.04)]",
        selected ? "border-foreground bg-muted/50" : "border-border bg-card hover:border-muted-foreground/30",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{scenario.tag}</span>
        {scenario.gapClosed ? (
          <span className="flex items-center gap-1 text-[11px] text-success">
            <Check className="size-3" /> closes gap
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-danger">
            <X className="size-3" /> gap open
          </span>
        )}
      </div>
      <span className="text-sm font-semibold text-foreground">{scenario.name}</span>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Safe-to-spend</div>
          <AnimatedCurrency
            value={scenario.safeToSpend}
            className={cn(
              "block font-mono text-lg tabular-nums",
              scenario.safeToSpend >= 0 ? "text-success" : "text-danger",
            )}
          />
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          risk <LevelDots level={scenario.relationshipRisk} invert />
        </div>
      </div>
    </button>
  )
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 font-mono text-sm tabular-nums",
          tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  )
}
