import { NextResponse } from "next/server";

import { runMigrations } from "@/lib/db/client";
import {
  isIntentToReceive,
  processXeroWebhookPayload,
  type XeroWebhookPayload,
} from "@/lib/xero/process-webhook";
import { verifyXeroSignature } from "@/lib/xero/webhooks";

export async function POST(request: Request) {
  runMigrations();

  const rawBody = await request.text();
  const webhookKey = process.env.XERO_WEBHOOK_KEY?.trim();

  if (!webhookKey) {
    console.error("[xero webhook] XERO_WEBHOOK_KEY is not configured");
    return new NextResponse("Webhook key not configured", { status: 401 });
  }

  const signature = request.headers.get("x-xero-signature");
  if (!signature || !verifyXeroSignature(rawBody, signature, webhookKey)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: XeroWebhookPayload = {};
  try {
    payload = JSON.parse(rawBody) as XeroWebhookPayload;
  } catch {
    console.warn("[xero webhook] received non-JSON payload");
    return new NextResponse(null, { status: 200 });
  }

  if (isIntentToReceive(payload)) {
    console.log("[xero webhook] intent-to-receive verified");
    return new NextResponse(null, { status: 200 });
  }

  for (const event of payload.events ?? []) {
    console.log(
      "[xero webhook]",
      event.eventCategory ?? "unknown",
      event.eventType ?? "unknown",
      event.resourceId ?? "",
    );
  }

  void processXeroWebhookPayload(payload).catch((error) => {
    console.error(
      "[xero webhook] async processing failed:",
      error instanceof Error ? error.message : error,
    );
  });

  return new NextResponse(null, { status: 200 });
}
