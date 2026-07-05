import { NextResponse } from "next/server";
import { DEMO_CONTACT_PHONE } from "@/lib/forecast/engine";
import {
  buildOpeningMessages,
  type CallContext,
} from "@/lib/comms/conversation-relay";
import { encodeCallContextQuery } from "@/lib/comms/call-context";
import { createCallSession } from "@/lib/comms/call-state";
import { logCall } from "@/lib/comms/call-logger";
import { getPublicBaseUrl } from "@/lib/comms/public-url";
import { toVoiceAddress } from "@/lib/comms/phone";
import { getTwilioClient, getTwilioConfig } from "@/lib/comms/twilio-client";
import { runMigrations } from "@/lib/db/client";

type PlaceCallRequest = {
  to?: string;
  contactName?: string;
  invoiceAmount?: number;
  daysOverdue?: number;
  invoiceNumber?: string;
};

const DEFAULT_CONTEXT: CallContext = {
  contactName: "BrightBuild Ltd",
  invoiceAmount: 2400,
  daysOverdue: 17,
  invoiceNumber: "SQZ-BB-2400",
};

export async function POST(request: Request) {
  runMigrations();
  let payload: PlaceCallRequest = {};
  try {
    const text = await request.text();
    if (text) payload = JSON.parse(text) as PlaceCallRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const context: CallContext = {
    contactName: payload.contactName?.trim() || DEFAULT_CONTEXT.contactName,
    invoiceAmount: payload.invoiceAmount ?? DEFAULT_CONTEXT.invoiceAmount,
    daysOverdue: payload.daysOverdue ?? DEFAULT_CONTEXT.daysOverdue,
    invoiceNumber: payload.invoiceNumber?.trim() || DEFAULT_CONTEXT.invoiceNumber,
  };

  const rawTo = payload.to?.trim() || process.env.DEMO_CALL_TO?.trim() || DEMO_CONTACT_PHONE;
  let to: string;
  try {
    to = toVoiceAddress(rawTo);
  } catch {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is required for AI call dialogue (GPT replies)." },
      { status: 503 },
    );
  }

  let baseUrl: string;
  try {
    baseUrl = getPublicBaseUrl();
  } catch (error) {
    const message = error instanceof Error ? error.message : "PUBLIC_BASE_URL is required";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let voiceFrom: string;
  try {
    const config = getTwilioConfig();
    if (!config.voiceFrom) {
      return NextResponse.json(
        { error: "TWILIO_VOICE_FROM is required for outbound voice calls" },
        { status: 500 },
      );
    }
    voiceFrom = config.voiceFrom;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Twilio is not configured";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const voiceUrl = `${baseUrl}/api/calls/voice?${encodeCallContextQuery(context)}`;

  logCall("place.start", {
    detail: `→ ${to}`,
    meta: { contact: context.contactName, voiceUrl, from: voiceFrom },
  });

  try {
    const client = getTwilioClient();
    const call = await client.calls.create({
      to,
      from: voiceFrom,
      url: voiceUrl,
      method: "POST",
      statusCallback: `${baseUrl}/api/calls/status`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed", "failed", "busy", "no-answer"],
    });

    createCallSession(call.sid, context, buildOpeningMessages(context));

    logCall("place.ok", {
      callSid: call.sid,
      detail: `Twilio call queued to ${to}`,
      meta: { contact: context.contactName, status: call.status },
    });

    return NextResponse.json({
      placed: true,
      callSid: call.sid,
      to,
      from: voiceFrom,
      context,
      voicePipeline: "twilio-gather-stt + gpt-4o-text + polly-tts",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to place call";
    logCall("place.error", { detail: message, meta: { contact: context.contactName, to } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
