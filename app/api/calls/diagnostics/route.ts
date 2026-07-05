import { NextResponse } from "next/server";
import { getCallLogPath, readRecentCallLogs } from "@/lib/comms/call-logger";
import { getPublicBaseUrl } from "@/lib/comms/public-url";
import { getTwilioConfig } from "@/lib/comms/twilio-client";
import { runMigrations } from "@/lib/db/client";

export async function GET() {
  runMigrations();

  const openai = Boolean(process.env.OPENAI_API_KEY?.trim());
  let publicBaseUrl: string | null = null;
  try {
    publicBaseUrl = getPublicBaseUrl();
  } catch {
    publicBaseUrl = null;
  }

  let twilio: { voiceFrom?: string; whatsappFrom: string } | null = null;
  try {
    const config = getTwilioConfig();
    twilio = { voiceFrom: config.voiceFrom, whatsappFrom: config.whatsappFrom };
  } catch {
    twilio = null;
  }

  const recentLogs = readRecentCallLogs(30);

  return NextResponse.json({
    ready: Boolean(openai && publicBaseUrl && twilio?.voiceFrom),
    architecture: {
      note: "Demo pipeline — NOT OpenAI Realtime voice. Production low-latency pattern uses Twilio Media Streams + OpenAI Realtime WebSocket bridge.",
      stt: "Twilio <Gather speechModel=phone_call enhanced=true>",
      llm: "OpenAI gpt-4o chat completions (text)",
      tts: "Amazon Polly Amy via Twilio <Say>",
      webhooks: [
        "{PUBLIC_BASE_URL}/api/calls/voice",
        "{PUBLIC_BASE_URL}/api/calls/voice/respond",
        "{PUBLIC_BASE_URL}/api/calls/status",
      ],
    },
    config: {
      openai,
      publicBaseUrl,
      twilioVoiceFrom: twilio?.voiceFrom ?? null,
      twilioConfigured: Boolean(twilio),
    },
    logFile: getCallLogPath(),
    recentLogs,
  });
}
