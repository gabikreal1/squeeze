import { NextResponse } from "next/server";
import { runCopilotChat, type CopilotMessage, isCopilotConfigured } from "@/lib/agent/copilot";
import type { ApiForecastResponse } from "@/lib/api/format-forecast";
import {
  formatDemoForecastResponse,
  formatLiveForecastResponse,
} from "@/lib/api/format-forecast";
import { runMigrations } from "@/lib/db/client";

type ChatRequest = {
  messages: CopilotMessage[];
  forecastContext?: ApiForecastResponse;
};

async function resolveForecast(
  forecastContext?: ApiForecastResponse,
): Promise<ApiForecastResponse> {
  if (forecastContext) return forecastContext;

  try {
    const live = await formatLiveForecastResponse();
    if (live) return live;
  } catch (error) {
    console.warn(
      "[copilot] live forecast failed, using demo:",
      error instanceof Error ? error.message : error,
    );
  }

  return formatDemoForecastResponse();
}

export async function POST(request: Request) {
  runMigrations();

  if (!isCopilotConfigured()) {
    return NextResponse.json(
      { error: "Finance Copilot is not configured (OPENAI_API_KEY missing)." },
      { status: 503 },
    );
  }

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  const invalid = body.messages.some(
    (m) =>
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.text !== "string" ||
      !m.text.trim(),
  );
  if (invalid) {
    return NextResponse.json(
      { error: "Each message needs role (user|assistant) and non-empty text" },
      { status: 400 },
    );
  }

  try {
    const forecast = await resolveForecast(body.forecastContext);
    const result = await runCopilotChat(body.messages, forecast);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Copilot request failed";
    console.error("[copilot/chat]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
