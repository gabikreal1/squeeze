"use client";

import { GapDiagnosis } from "./gap-diagnosis";
import { GuardrailStrip } from "./guardrail-strip";
import { CommandCentre } from "./command-centre";
import type { ForecastResponse, TimelinePoint } from "@/lib/squeeze-data";
import { FadeIn } from "./animated-list";

export function TodayView({
  forecast,
  healed,
  ghostTimeline,
  onGoToCustomers,
}: {
  forecast: ForecastResponse;
  healed: boolean;
  ghostTimeline?: TimelinePoint[];
  onGoToCustomers: () => void;
}) {
  return (
    <div className="space-y-4">
      <FadeIn>
        <CommandCentre
          forecast={forecast}
          healed={healed}
          ghostTimeline={ghostTimeline}
          onGoToActions={onGoToCustomers}
        />
      </FadeIn>
      {!healed && forecast.gap && (
        <FadeIn delay={0.1}>
          <GapDiagnosis forecast={forecast} />
        </FadeIn>
      )}
      <FadeIn delay={0.15}>
        <GuardrailStrip />
      </FadeIn>
    </div>
  );
}
