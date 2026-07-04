"use client";

import CountUp from "@/components/CountUp";

export function AnimatedCurrency({
  value,
  className,
  duration = 1.4,
  showPlus = false,
}: {
  value: number;
  className?: string;
  duration?: number;
  showPlus?: boolean;
}) {
  const negative = value < 0;
  const sign = negative ? "−" : showPlus ? "+" : "";
  return (
    <span className={className}>
      {sign}£
      <CountUp to={Math.abs(Math.round(value))} separator="," duration={duration} />
    </span>
  );
}
