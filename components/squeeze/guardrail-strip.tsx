"use client";

import { ShieldCheck } from "lucide-react";
import { guardrails } from "@/lib/squeeze-data";
import { Panel, SectionLabel } from "./primitives";

export function GuardrailStrip() {
  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="size-4 text-primary" />
        <SectionLabel>Protections active</SectionLabel>
      </div>
      <div className="flex flex-wrap gap-2">
        {guardrails.slice(0, 6).map((g) => (
          <span
            key={g.title}
            className="rounded-full border border-border bg-background/50 px-2.5 py-1 text-[11px] text-muted-foreground"
            title={g.desc}
          >
            {g.title}
          </span>
        ))}
      </div>
    </Panel>
  );
}
