import { NextResponse } from "next/server";
import type { ActionRung } from "@/lib/decision/types";
import { sendWhatsAppMessage } from "@/lib/comms/whatsapp";
import { runMigrations } from "@/lib/db/client";
import { resolveContactPhone } from "@/lib/xero/contact-phone";

const ALLOWED_RUNGS = new Set<ActionRung>(["nudge", "firm_reminder"]);

type WhatsAppRequest = {
  customer: string;
  contactId?: string;
  contactPhone?: string;
  invoiceNumber?: string;
  amount: number;
  daysOverdue?: number;
  rung?: ActionRung;
  dontSqueeze?: boolean;
  orgName?: string;
};

export async function POST(request: Request) {
  runMigrations();

  let payload: WhatsAppRequest;
  try {
    payload = (await request.json()) as WhatsAppRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { customer, amount, invoiceNumber, orgName, dontSqueeze, contactId } = payload;
  const rung = payload.rung ?? "nudge";
  const daysOverdue = payload.daysOverdue ?? 0;

  if (!customer?.trim()) {
    return NextResponse.json({ error: "customer is required" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }
  if (!ALLOWED_RUNGS.has(rung)) {
    return NextResponse.json(
      { error: "Only nudge and firm_reminder can be sent via WhatsApp" },
      { status: 400 },
    );
  }

  let to = payload.contactPhone?.trim();
  if (!to) {
    to = (await resolveContactPhone({ contactId, contactName: customer.trim() })) ?? undefined;
  }
  if (!to) {
    return NextResponse.json(
      {
        error:
          "No phone on this Xero contact. Add a mobile number to the customer in Xero invoicing.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await sendWhatsAppMessage({
      customer: customer.trim(),
      invoiceNumber,
      amount,
      daysOverdue,
      rung,
      dontSqueeze,
      orgName,
      to,
    });

    return NextResponse.json({
      sent: true,
      sid: result.sid,
      to: result.to,
      preview: result.body,
      usedTemplate: result.usedTemplate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send WhatsApp message";
    console.error("[whatsapp]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
