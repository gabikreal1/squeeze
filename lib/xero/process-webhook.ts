import { formatLiveForecastResponse } from "../api/format-forecast";
import { broadcastSqueezeEvent } from "../events/sse-hub";
import { getPaymentById } from "./payments";

export type XeroWebhookEvent = {
  resourceUrl?: string;
  resourceId?: string;
  eventDateUtc?: string;
  eventType?: string;
  eventCategory?: string;
  tenantId?: string;
  tenantType?: string;
};

export type XeroWebhookPayload = {
  events?: XeroWebhookEvent[];
  firstEventSequence?: number;
  lastEventSequence?: number;
  entropy?: string;
};

function normalise(value: string | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

export function isIntentToReceive(payload: XeroWebhookPayload): boolean {
  return (payload.events?.length ?? 0) === 0;
}

export function shouldRefreshForecast(event: XeroWebhookEvent): boolean {
  const category = normalise(event.eventCategory);
  const type = normalise(event.eventType);
  if (category === "PAYMENT" && (type === "CREATE" || type === "UPDATE")) {
    return true;
  }
  if (category === "INVOICE" && type === "UPDATE") {
    return true;
  }
  return false;
}

async function paymentAmountFromEvent(event: XeroWebhookEvent): Promise<number | undefined> {
  if (normalise(event.eventCategory) !== "PAYMENT" || !event.resourceId) {
    return undefined;
  }
  try {
    const payment = await getPaymentById(event.resourceId);
    return payment?.amount ?? undefined;
  } catch (error) {
    console.warn("[xero webhook] could not load payment:", error);
    return undefined;
  }
}

export async function refreshForecastFromXero(options?: {
  paymentAmount?: number;
  source?: "webhook" | "payment" | "refresh";
  eventCategory?: string;
  eventType?: string;
}): Promise<void> {
  const forecast = await formatLiveForecastResponse({
    paymentAmount: options?.paymentAmount,
  });
  if (!forecast) {
    console.warn("[xero webhook] forecast refresh skipped — Xero unavailable");
    return;
  }

  broadcastSqueezeEvent({
    type: "forecast-updated",
    payload: {
      forecast,
      source: options?.source ?? "refresh",
      paymentAmount: options?.paymentAmount,
      eventCategory: options?.eventCategory,
      eventType: options?.eventType,
    },
  });
}

export async function processXeroWebhookPayload(payload: XeroWebhookPayload): Promise<void> {
  const refreshEvents = (payload.events ?? []).filter(shouldRefreshForecast);
  if (refreshEvents.length === 0) return;

  for (const event of refreshEvents) {
    broadcastSqueezeEvent({
      type: "webhook-received",
      payload: {
        eventCategory: event.eventCategory ?? "UNKNOWN",
        eventType: event.eventType ?? "UNKNOWN",
      },
    });
  }

  let paymentAmount: number | undefined;
  const paymentEvent = refreshEvents.find(
    (event) => normalise(event.eventCategory) === "PAYMENT",
  );
  if (paymentEvent) {
    paymentAmount = await paymentAmountFromEvent(paymentEvent);
  }

  const lead = refreshEvents[0];
  await refreshForecastFromXero({
    paymentAmount,
    source: "webhook",
    eventCategory: lead.eventCategory,
    eventType: lead.eventType,
  });
}
