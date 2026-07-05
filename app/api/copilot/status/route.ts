import { NextResponse } from "next/server";
import { isCopilotConfigured } from "@/lib/agent/copilot";

export async function GET() {
  return NextResponse.json({
    ready: isCopilotConfigured(),
  });
}
