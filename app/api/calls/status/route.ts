import { deleteCallSession } from "@/lib/comms/call-state";
import { logCall } from "@/lib/comms/call-logger";
import { runMigrations } from "@/lib/db/client";

/** Twilio status callback — logs lifecycle and cleans up session when call ends. */
export async function POST(request: Request) {
  runMigrations();
  const form = await request.formData();
  const callSid = String(form.get("CallSid") ?? "").trim();
  const status = String(form.get("CallStatus") ?? "").trim();
  const duration = String(form.get("CallDuration") ?? "").trim();
  const errorCode = String(form.get("ErrorCode") ?? "").trim();
  const errorMessage = String(form.get("ErrorMessage") ?? "").trim();

  logCall("status", {
    callSid: callSid || undefined,
    detail: status,
    meta: {
      duration: duration || undefined,
      errorCode: errorCode || undefined,
      errorMessage: errorMessage || undefined,
      from: form.get("From"),
      to: form.get("To"),
    },
  });

  if (callSid && ["completed", "failed", "busy", "no-answer", "canceled"].includes(status)) {
    deleteCallSession(callSid);
  }

  return new Response(null, { status: 204 });
}
