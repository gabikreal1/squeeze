"use client";

import { useEffect, useRef } from "react";
import type { ApiForecastResponse } from "@/lib/api/format-forecast";
import type { ForecastUpdatedPayload } from "@/lib/events/sse-hub";

type UseForecastEventsOptions = {
  enabled: boolean;
  onForecastUpdated: (payload: ForecastUpdatedPayload) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
};

export function useForecastEvents({
  enabled,
  onForecastUpdated,
  onConnected,
  onDisconnected,
}: UseForecastEventsOptions) {
  const handlerRef = useRef(onForecastUpdated);
  handlerRef.current = onForecastUpdated;
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;
  const onDisconnectedRef = useRef(onDisconnected);
  onDisconnectedRef.current = onDisconnected;

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource("/api/events");

    source.addEventListener("connected", () => {
      onConnectedRef.current?.();
    });

    source.addEventListener("forecast-updated", (event) => {
      try {
        const payload = JSON.parse(event.data) as ForecastUpdatedPayload;
        handlerRef.current(payload);
      } catch (error) {
        console.error("[sse] invalid forecast-updated payload", error);
      }
    });

    source.onerror = () => {
      onDisconnectedRef.current?.();
    };

    return () => {
      source.close();
      onDisconnectedRef.current?.();
    };
    // Callbacks are read through refs so the stream opens once per `enabled`
    // change instead of reconnecting on every parent re-render.
  }, [enabled]);
}

export type { ApiForecastResponse, ForecastUpdatedPayload };
