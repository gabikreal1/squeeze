import { NextResponse } from "next/server";
import {
  formatDemoForecastResponse,
  formatLiveForecastResponse,
} from "@/lib/api/format-forecast";
import { runMigrations } from "@/lib/db/client";

export async function GET() {
  runMigrations();

  try {
    const live = await formatLiveForecastResponse();
    if (live) {
      return NextResponse.json(live);
    }
  } catch (error) {
    console.warn("[forecast] live load failed, using demo:", error instanceof Error ? error.message : error);
  }

  return NextResponse.json(formatDemoForecastResponse());
}
