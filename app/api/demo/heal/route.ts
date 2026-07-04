import { NextResponse } from "next/server";
import {
  applyDemoHealOverlay,
  formatDemoForecastResponse,
  formatLiveForecastResponse,
} from "@/lib/api/format-forecast";
import { runMigrations } from "@/lib/db/client";
import {
  markDemoHealApplied,
  markInvoicePaidSimulated,
  resetDemoHealState,
} from "@/lib/forecast/xero-loader";

const BRIGHTBUILD_INVOICE = "SQZ-BB-2400";
const BRIGHTBUILD_AMOUNT = 2400;

export async function POST() {
  runMigrations();

  markInvoicePaidSimulated(BRIGHTBUILD_INVOICE, BRIGHTBUILD_AMOUNT);
  markDemoHealApplied();

  try {
    const forecast = await formatLiveForecastResponse();
    if (forecast) {
      const healed = applyDemoHealOverlay(forecast, BRIGHTBUILD_AMOUNT);
      return NextResponse.json({ healed: true, forecast: healed });
    }
  } catch (error) {
    console.warn("[heal] live load failed, using demo overlay:", error);
  }

  const demo = applyDemoHealOverlay(
    formatDemoForecastResponse(),
    BRIGHTBUILD_AMOUNT,
  );
  return NextResponse.json({ healed: true, forecast: demo });
}

/** Reset simulate-payment state for another demo run. */
export async function DELETE() {
  runMigrations();
  resetDemoHealState();
  return NextResponse.json({ reset: true });
}
