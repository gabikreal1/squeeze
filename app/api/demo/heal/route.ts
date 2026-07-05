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
import { isXeroConnected } from "@/lib/xero/client";
import { reverseInvoicePayment } from "@/lib/xero/payments";

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

/** Reset simulate-payment state and restore the pre-payment demo gap. */
export async function DELETE() {
  runMigrations();
  resetDemoHealState();

  // Undo the real Xero payment so the pay → heal → replay cycle is repeatable.
  if (isXeroConnected()) {
    try {
      const reversed = await reverseInvoicePayment(BRIGHTBUILD_INVOICE);
      if (reversed > 0) {
        console.log(`[heal] reversed ${reversed} payment(s) on ${BRIGHTBUILD_INVOICE}`);
      }
    } catch (error) {
      console.warn("[heal] failed to reverse Xero payment on reset:", error);
    }
  }

  try {
    const forecast = await formatLiveForecastResponse();
    if (forecast) {
      return NextResponse.json({ reset: true, forecast });
    }
  } catch (error) {
    console.warn("[heal] live load failed on reset, using demo:", error);
  }

  return NextResponse.json({
    reset: true,
    forecast: formatDemoForecastResponse(),
  });
}
