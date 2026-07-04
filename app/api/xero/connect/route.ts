import { NextResponse } from "next/server";
import { buildConsentUrl } from "@/lib/xero/oauth";

export async function GET() {
  try {
    const url = await buildConsentUrl();
    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
