"use client"

import { ArrowUpRight, Banknote, LineChart, ShoppingCart, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { briefing } from "@/lib/squeeze-data"
import { cn } from "@/lib/utils"
import { Panel, SectionLabel } from "./primitives"

const roleIcons: Record<string, LucideIcon> = {
  "Credit Controller": Banknote,
  Treasury: LineChart,
  Procurement: ShoppingCart,
  Revenue: Users,
}

export function BriefingView() {
  return (
    <div className="space-y-4">
      <Panel className="relative overflow-hidden p-6">
        <SectionLabel>Monday briefing</SectionLabel>
        <h2 className="mt-2 max-w-2xl text-balance text-2xl font-semibold leading-tight tracking-tight text-foreground">
          Squeeze is becoming a whole finance department for Maya&apos;s Catering.
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Four roles, one operator. Here&apos;s what each function flagged this week.
        </p>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        {briefing.map((b) => {
          const Icon = roleIcons[b.role] ?? Banknote
          const accent =
            b.accent === "danger"
              ? "border-danger/30"
              : b.accent === "lemon"
                ? "border-primary/30"
                : "border-border"
          const iconTone =
            b.accent === "danger" ? "text-danger" : b.accent === "lemon" ? "text-primary" : "text-muted-foreground"
          return (
            <Panel key={b.role} className={cn("group flex flex-col gap-3 p-6 transition hover:border-primary/40", accent)}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Icon className={cn("size-4", iconTone)} />
                  <SectionLabel>{b.role}</SectionLabel>
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" />
              </div>
              <h3 className="text-pretty text-lg font-semibold leading-snug text-foreground">{b.headline}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{b.detail}</p>
            </Panel>
          )
        })}
      </div>
    </div>
  )
}
