"use client"

import {
  Building2,
  FileText,
  Gavel,
  Hand,
  Heart,
  History,
  Phone,
  ShieldCheck,
  Lock,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { guardrails } from "@/lib/squeeze-data"
import { Panel, SectionLabel } from "./primitives"

const icons: Record<string, LucideIcon> = {
  building: Building2,
  file: FileText,
  phone: Phone,
  shield: ShieldCheck,
  history: History,
  gavel: Gavel,
  heart: Heart,
  hand: Hand,
}

const gates = [
  { name: "AI phone call", desc: "A disclosed automated call to a debtor.", level: "Approval required" },
  { name: "Invoice financing", desc: "Advancing cash against an invoice for a fee.", level: "Approval required" },
  { name: "Legal evidence pack", desc: "Preparing a Letter Before Action bundle.", level: "Approval required" },
  { name: "Customer-sensitive account", desc: "Any action on a flagged key relationship.", level: "Extra confirmation" },
]

export function GuardrailsView() {
  return (
    <div className="space-y-4">
      <Panel className="relative overflow-hidden p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-success" />
          <SectionLabel>How Squeeze stays safe</SectionLabel>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Squeeze is a careful operator, not a loose cannon. These rules are always on — the AI cannot act outside them.
        </p>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {guardrails.map((g) => {
          const Icon = icons[g.icon] ?? ShieldCheck
          return (
            <Panel key={g.title} className="flex flex-col gap-3 p-5">
              <div className="flex size-9 items-center justify-center rounded-lg border border-success/25 bg-success/10">
                <Icon className="size-4 text-success" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{g.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{g.desc}</p>
              </div>
            </Panel>
          )
        })}
      </div>

      <Panel className="p-6">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-primary" />
          <SectionLabel>Approval gates for serious actions</SectionLabel>
        </div>
        <div className="mt-4 divide-y divide-border">
          {gates.map((gate) => (
            <div key={gate.name} className="flex items-center justify-between gap-4 py-3">
              <div>
                <div className="text-sm font-medium text-foreground">{gate.name}</div>
                <div className="text-xs text-muted-foreground">{gate.desc}</div>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                <Lock className="size-3" /> {gate.level}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
