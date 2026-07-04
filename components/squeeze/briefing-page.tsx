"use client";

import { BriefingView } from "./briefing-view";
import { HealthView } from "./health-view";
import { FadeIn } from "./animated-list";

export function BriefingPage() {
  return (
    <div className="space-y-4">
      <FadeIn>
        <BriefingView />
      </FadeIn>
      <FadeIn delay={0.1}>
        <HealthView />
      </FadeIn>
    </div>
  );
}
