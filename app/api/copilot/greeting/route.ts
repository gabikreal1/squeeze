import { NextResponse } from "next/server";
import {
  isCopilotConfigured,
  runCopilotGreeting,
} from "@/lib/agent/copilot";
import type { ApiForecastResponse } from "@/lib/api/format-forecast";
import {
  formatDemoForecastResponse,
  formatLiveForecastResponse,
} from "@/lib/api/format-forecast";
import { runMigrations } from "@/lib/db/client";

async function resolveForecast(
  forecastContext?: ApiForecastResponse,
): Promise<ApiForecastResponse> {
  if (forecastContext) return forecastContext;

  try {
    const live = await formatLiveForecastResponse();
    if (live) return live;
  } catch (error) {
    console.warn(
      "[copilot/greeting] live forecast failed:",
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

  let forecastContext: ApiForecastResponse | undefined;
  try {
    const body = (await request.json()) as {
      forecastContext?: ApiForecastResponse;
    };
    forecastContext = body.forecastContext;
  } catch {
    forecastContext = undefined;
  }

  try {
    const forecast = await resolveForecast(forecastContext);
    const result = await runCopilotGreeting(forecast);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Greeting request failed";
    console.error("[copilot/greeting]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
