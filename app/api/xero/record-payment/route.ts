import { NextResponse } from "next/server";

import {
  applyDemoHealOverlay,
  formatDemoForecastResponse,
  formatLiveForecastResponse,
} from "@/lib/api/format-forecast";
import { runMigrations } from "@/lib/db/client";
import { refreshForecastFromXero } from "@/lib/xero/process-webhook";
import { recordInvoicePayment } from "@/lib/xero/payments";
import { isXeroConnected } from "@/lib/xero/client";
import {
  markDemoHealApplied,
  markInvoicePaidSimulated,
} from "@/lib/forecast/xero-loader";

const DEFAULT_INVOICE = "SQZ-BB-2400";

type RecordPaymentRequest = {
  invoiceNumber?: string;
  amount?: number;
};

export async function POST(request: Request) {
  runMigrations();

  if (!isXeroConnected()) {
    return NextResponse.json({ error: "Xero is not connected." }, { status: 503 });
  }

  let payload: RecordPaymentRequest = {};
  try {
    payload = (await request.json()) as RecordPaymentRequest;
  } catch {
    payload = {};
  }

  const invoiceNumber = payload.invoiceNumber?.trim() || DEFAULT_INVOICE;

  try {
    const payment = await recordInvoicePayment({
      invoiceNumber,
      amount: payload.amount,
    });

    markInvoicePaidSimulated(invoiceNumber, payment.amount);
    markDemoHealApplied();

    const liveForecast = await formatLiveForecastResponse({
      paymentAmount: payment.amount,
    });
    const forecast =
      liveForecast ??
      applyDemoHealOverlay(formatDemoForecastResponse(), payment.amount);

    // Webhook will push SSE; also refresh immediately in case webhooks lag.
    void refreshForecastFromXero({
      paymentAmount: payment.amount,
      source: "payment",
      eventCategory: "PAYMENT",
      eventType: "CREATE",
    }).catch((error) => {
      console.warn("[record-payment] immediate refresh failed:", error);
    });

    return NextResponse.json({
      recorded: true,
      paymentId: payment.paymentId,
      invoiceNumber: payment.invoiceNumber,
      amount: payment.amount,
      forecast,
      message: "Payment recorded in Xero. Forecast updated.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record payment";
    console.error("[record-payment]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
