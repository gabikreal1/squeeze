import { buildInitialGreeting } from "@/lib/comms/conversation-relay";
import { parseCallContextFromSearchParams } from "@/lib/comms/call-context";
import { ensureCallSession } from "@/lib/comms/call-state";
import { logCall } from "@/lib/comms/call-logger";
import { runMigrations } from "@/lib/db/client";
import { sayAndGather } from "@/lib/comms/voice-twiml";

export async function POST(request: Request) {
  runMigrations();
  const url = new URL(request.url);
  const form = await request.formData();
  const callSid = String(form.get("CallSid") ?? "").trim();

  if (!callSid) {
    return new Response("Missing CallSid", { status: 400 });
  }

  const contextFromUrl = parseCallContextFromSearchParams(url.searchParams);
  const session = ensureCallSession(callSid, contextFromUrl ?? undefined);
  const greeting = buildInitialGreeting(session.context);

  logCall("voice.greeting", {
    callSid,
    detail: greeting.slice(0, 120),
    meta: {
      contact: session.context.contactName,
      fromUrl: Boolean(contextFromUrl),
      callStatus: form.get("CallStatus"),
    },
  });

  return sayAndGather(greeting, callSid);
}
