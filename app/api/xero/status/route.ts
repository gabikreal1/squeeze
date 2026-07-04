import { NextResponse } from "next/server";
import { isXeroConnected } from "@/lib/xero/client";
import { loadXeroTenantId } from "@/lib/xero/token-store";

export async function GET() {
  const connected = isXeroConnected();
  const tenantId = loadXeroTenantId();

  return NextResponse.json({
    connected,
    tenantId: tenantId ?? null,
    connectUrl: "/api/xero/connect",
  });
}
