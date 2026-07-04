"use client";

import type { ReactNode } from "react";
import BorderGlow from "@/components/BorderGlow";

/**
 * Theme-aware wrapper around React Bits BorderGlow.
 * Uses the card CSS variable so it works in both light and dark modes,
 * and tints the glow/mesh to the Squeeze palette.
 */
export function GlowCard({
  children,
  className = "",
  tone = "lemon",
  borderRadius = 16,
}: {
  children: ReactNode;
  className?: string;
  tone?: "lemon" | "danger";
  borderRadius?: number;
}) {
  const palette =
    tone === "danger"
      ? { glowColor: "0 72 51", colors: ["#ef4444", "#71717a", "#ef4444"] }
      : { glowColor: "0 0 0", colors: ["#fafafa", "#71717a", "#fafafa"] };

  return (
    <BorderGlow
      animated
      backgroundColor="var(--card)"
      glowColor={palette.glowColor}
      colors={palette.colors}
      glowIntensity={0.75}
      glowRadius={32}
      borderRadius={borderRadius}
      className={className}
    >
      {children}
    </BorderGlow>
  );
}
