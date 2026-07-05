import { generateCallReply } from "@/lib/comms/conversation-relay";
import {
  deleteCallSession,
  ensureCallSession,
  MAX_CALL_TURNS,
  saveCallSession,
} from "@/lib/comms/call-state";
import { logCall } from "@/lib/comms/call-logger";
import { runMigrations } from "@/lib/db/client";
import { sayAndGather, sayAndHangUp } from "@/lib/comms/voice-twiml";

const NO_INPUT_MESSAGE =
  "I didn't catch that. Could you let me know when payment is expected?";
const GOODBYE_MESSAGE =
  "Thank you for your time. We'll follow up by email if needed. Goodbye.";

export async function POST(request: Request) {
  runMigrations();
  const url = new URL(request.url);
  const form = await request.formData();
  const callSid =
    url.searchParams.get("CallSid")?.trim() ||
    String(form.get("CallSid") ?? "").trim();

  if (!callSid) {
    return new Response("Missing CallSid", { status: 400 });
  }

  const session = ensureCallSession(callSid);
  const noInput = url.searchParams.get("NoInput") === "1";
  const speechResult = String(form.get("SpeechResult") ?? "").trim();
  const confidence = String(form.get("Confidence") ?? "").trim();

  if (noInput || !speechResult) {
    logCall("voice.no_input", {
      callSid,
      detail: noInput ? "timeout" : "empty transcript",
      meta: { turn: session.turn, confidence },
    });

    if (session.turn >= MAX_CALL_TURNS) {
      deleteCallSession(callSid);
      return sayAndHangUp(GOODBYE_MESSAGE);
    }
    saveCallSession(callSid, session);
    return sayAndGather(NO_INPUT_MESSAGE, callSid);
  }

  logCall("voice.respond", {
    callSid,
    detail: speechResult.slice(0, 160),
    meta: { turn: session.turn + 1, confidence },
  });

  session.turn += 1;
  session.messages.push({ role: "user", content: speechResult });
  saveCallSession(callSid, session);

  let reply: string;
  try {
    reply = await generateCallReply(session.messages, callSid);
  } catch {
    logCall("voice.openai.error", {
      callSid,
      detail: "hanging up after OpenAI failure",
    });
    deleteCallSession(callSid);
    return sayAndHangUp(GOODBYE_MESSAGE);
  }

  session.messages.push({ role: "assistant", content: reply });
  saveCallSession(callSid, session);

  if (session.turn >= MAX_CALL_TURNS) {
    deleteCallSession(callSid);
    return sayAndHangUp(`${reply} ${GOODBYE_MESSAGE}`);
  }

  return sayAndGather(reply, callSid);
}
