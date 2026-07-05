import fs from "node:fs";
import path from "node:path";

export type CallLogEvent =
  | "place.start"
  | "place.ok"
  | "place.error"
  | "voice.greeting"
  | "voice.respond"
  | "voice.no_input"
  | "voice.openai.start"
  | "voice.openai.ok"
  | "voice.openai.error"
  | "status"
  | "session.create"
  | "session.save"
  | "session.delete"
  | "session.recover";

export type CallLogEntry = {
  ts: string;
  event: CallLogEvent;
  callSid?: string;
  ms?: number;
  detail?: string;
  meta?: Record<string, unknown>;
};

const LOG_DIR = path.join(process.cwd(), "data");
const LOG_FILE = path.join(LOG_DIR, "calls.log");
const MAX_TAIL_LINES = 100;

function appendLine(entry: CallLogEntry): void {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf-8");
  } catch (error) {
    console.error("[calls/log] could not write log file:", error);
  }
}

export function logCall(
  event: CallLogEvent,
  fields: Omit<CallLogEntry, "ts" | "event"> = {},
): void {
  const entry: CallLogEntry = {
    ts: new Date().toISOString(),
    event,
    ...fields,
  };
  const suffix = entry.callSid ? ` sid=${entry.callSid}` : "";
  const timing = entry.ms != null ? ` ${entry.ms}ms` : "";
  console.log(
    `[calls] ${event}${suffix}${timing}${entry.detail ? ` — ${entry.detail}` : ""}`,
    entry.meta ?? "",
  );
  appendLine(entry);
}

export function readRecentCallLogs(limit = 40): CallLogEntry[] {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const lines = fs.readFileSync(LOG_FILE, "utf-8").trim().split("\n").filter(Boolean);
    return lines
      .slice(-Math.min(limit, MAX_TAIL_LINES))
      .map((line) => JSON.parse(line) as CallLogEntry);
  } catch {
    return [];
  }
}

export function getCallLogPath(): string {
  return LOG_FILE;
}
