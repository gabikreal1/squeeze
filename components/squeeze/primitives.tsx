"use client";

import { useRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Level } from "@/lib/squeeze-data";

function trackSpotlight(el: HTMLDivElement, clientX: number, clientY: number) {
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--mouse-x", `${clientX - rect.left}px`);
  el.style.setProperty("--mouse-y", `${clientY - rect.top}px`);
}

export function Panel({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onMouseMove={(event) => {
        if (ref.current) trackSpotlight(ref.current, event.clientX, event.clientY);
      }}
      onMouseEnter={(event) => {
        if (ref.current) trackSpotlight(ref.current, event.clientX, event.clientY);
      }}
      className={cn(
        "spotlight-card rounded-xl border border-border bg-card",
        "light:shadow-[0_1px_3px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.04)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

const levelStyles: Record<Level, string> = {
  low: "text-success",
  medium: "text-warning",
  high: "text-danger",
};

export function LevelDots({
  level,
  invert,
}: {
  level: Level;
  invert?: boolean;
}) {
  const count = level === "low" ? 1 : level === "medium" ? 2 : 3;
  const color = invert ? levelStyles[level] : "text-primary";
  return (
    <span className="inline-flex items-center gap-1" aria-label={level}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i < count ? cn("bg-current", color) : "bg-muted-foreground/25",
          )}
        />
      ))}
    </span>
  );
}

export function Metric({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-sm tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export function RiskTag({
  level,
}: {
  level: "trusted" | "watch" | "at-risk" | "high-risk";
}) {
  const map = {
    trusted: "border-success/30 bg-success/10 text-success",
    watch: "border-warning/30 bg-warning/10 text-warning",
    "at-risk": "border-danger/30 bg-danger/10 text-danger",
    "high-risk": "border-danger/40 bg-danger/15 text-danger",
  } as const;
  const labels = {
    trusted: "Trusted",
    watch: "Watch",
    "at-risk": "At risk",
    "high-risk": "High risk",
  };
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
        map[level],
      )}
    >
      {labels[level]}
    </span>
  );
}
