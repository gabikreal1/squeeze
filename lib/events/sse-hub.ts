import type { ApiForecastResponse } from "../api/format-forecast";

export type ForecastUpdatedPayload = {
  forecast: ApiForecastResponse;
  source: "webhook" | "payment" | "refresh";
  paymentAmount?: number;
  eventCategory?: string;
  eventType?: string;
};

export type SqueezeEvent =
  | { type: "connected"; payload: { ok: true } }
  | { type: "forecast-updated"; payload: ForecastUpdatedPayload }
  | { type: "webhook-received"; payload: { eventCategory: string; eventType: string } };

type Listener = (event: SqueezeEvent) => void;

const listeners = new Set<Listener>();

export function subscribeSqueezeEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function broadcastSqueezeEvent(event: SqueezeEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("[sse] listener error:", error);
    }
  }
}
