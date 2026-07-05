"use client";

import type { ForecastResponse } from "@/lib/squeeze-data";
import { BriefingView } from "./briefing-view";
import { HealthView } from "./health-view";
import { FadeIn } from "./animated-list";

export function BriefingPage({
  forecast,
  healed,
}: {
  forecast: ForecastResponse;
  healed: boolean;
}) {
  return (
    <div className="space-y-4">
      <FadeIn>
        <BriefingView forecast={forecast} healed={healed} />
      </FadeIn>
      <FadeIn delay={0.1}>
        <HealthView forecast={forecast} healed={healed} />
      </FadeIn>
    </div>
  );
}
