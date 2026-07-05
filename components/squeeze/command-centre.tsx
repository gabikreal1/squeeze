"use client";

import { ArrowDownRight, ArrowUpRight, CheckCircle2, Info, TrendingDown } from "lucide-react";
import type { ForecastResponse, TimelinePoint } from "@/lib/squeeze-data";
import { gbp } from "@/lib/format";
import { Panel, SectionLabel } from "./primitives";
import { CashCurve } from "./cash-curve";
import { AnimatedCurrency } from "./animated-currency";
import StarBorder from "@/components/StarBorder";

export function CommandCentre({
  forecast,
  healed,
  ghostTimeline,
  onGoToActions,
}: {
  forecast: ForecastResponse;
  healed: boolean;
  ghostTimeline?: TimelinePoint[];
  onGoToActions: () => void;
}) {
  const negative = forecast.safeToSpend < 0;

  return (
    <div className="space-y-4">
      <Panel
        className={`p-6 md:p-8 ${
          healed ? "border-success/50" : negative ? "border-danger/40" : ""
        }`}
      >
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          <div>
            <SectionLabel>Safe to spend · next 14 days</SectionLabel>

            <div className="mt-3 flex items-end gap-3">
              {healed ? (
                <AnimatedCurrency
                  value={forecast.safeToSpend}
                  className="font-mono text-6xl font-semibold tabular-nums text-success md:text-7xl"
                />
              ) : (
                <AnimatedCurrency
                  value={forecast.safeToSpend}
                  className={`font-mono text-6xl font-semibold tabular-nums md:text-7xl ${
                    negative ? "text-danger" : "text-foreground"
                  }`}
                />
              )}
            </div>

            {healed ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <p>
                  <span className="font-semibold">Forecast healed.</span>{" "}
                  {forecast.paymentReceived ? `${gbp(forecast.paymentReceived)} received.` : "Payment landed."}{" "}
                  You&apos;re clear of the safe line.
                </p>
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                <TrendingDown className="mt-0.5 size-4 shrink-0" />
                <p>
                  <span className="font-semibold">
                    {forecast.gap?.dayLabel} you&apos;ll be {gbp(forecast.gap?.amount ?? 0)} under safe cash.
                  </span>{" "}
                  Payroll lands before your overdue invoices arrive.
                </p>
              </div>
            )}

            {!healed && (
              <StarBorder
                as="button"
                onClick={onGoToActions}
                color="#fafafa"
                speed="5s"
                thickness={1}
                className="mt-6"
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  Review Squeeze&apos;s recommended actions
                  <ArrowUpRight className="size-4" />
                </span>
              </StarBorder>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <div className="mb-1 flex items-center justify-between px-1">
              <SectionLabel>14-day cash curve</SectionLabel>
              {ghostTimeline && (
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="h-px w-4 border-t border-dashed border-muted-foreground" /> before
                </span>
              )}
            </div>
            <CashCurve
              timeline={forecast.timeline}
              buffer={forecast.buffer}
              ghostTimeline={ghostTimeline}
              healed={healed}
            />
          </div>
        </div>
      </Panel>

      {/* quick stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Panel className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowUpRight className="size-4 text-success" />
            <SectionLabel>Receivables</SectionLabel>
          </div>
          <AnimatedCurrency
            value={forecast.unpaidReceivables}
            className="mt-2 block font-mono text-2xl tabular-nums"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {healed
              ? "Gap closed — receivables updated after payment"
              : "Money owed to you across 4 customers"}
          </p>
        </Panel>
        <Panel className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowDownRight className="size-4 text-danger" />
            <SectionLabel>Payables (14d)</SectionLabel>
          </div>
          <AnimatedCurrency
            value={forecast.unpaidPayables}
            className="mt-2 block font-mono text-2xl tabular-nums"
          />
          <p className="mt-1 text-xs text-muted-foreground">Payroll, VAT and supplier outflows due</p>
        </Panel>
        <Panel className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Info className="size-4 text-primary" />
            <SectionLabel>Net position</SectionLabel>
          </div>
          <AnimatedCurrency
            value={forecast.unpaidReceivables - forecast.unpaidPayables}
            className="mt-2 block font-mono text-2xl tabular-nums"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {healed
              ? "Cash position restored above your safety buffer"
              : "Healthy on paper — timing is the problem"}
          </p>
        </Panel>
      </div>
    </div>
  );
}
