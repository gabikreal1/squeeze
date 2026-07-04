import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthCode } from "@/lib/xero/oauth";
import { runMigrations } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  runMigrations();

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json(
      { error: "Missing code — start at /api/xero/connect" },
      { status: 400 },
    );
  }

  try {
    const { tenantId, tenantName } = await exchangeAuthCode(request.url);

    return NextResponse.redirect(
      new URL(
        `/dashboard?xero=connected&tenant=${encodeURIComponent(tenantName)}&tenantId=${encodeURIComponent(tenantId)}`,
        request.url,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
