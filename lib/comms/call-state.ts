import type OpenAI from "openai";
import { getDb } from "../db/client";
import type { CallContext } from "./conversation-relay";
import { buildOpeningMessages } from "./conversation-relay";
import { logCall } from "./call-logger";

export type CallSession = {
  context: CallContext;
  turn: number;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
};

export const MAX_CALL_TURNS = 3;

const DEFAULT_CONTEXT: CallContext = {
  contactName: "BrightBuild Ltd",
  invoiceAmount: 2400,
  daysOverdue: 17,
  invoiceNumber: "SQZ-BB-2400",
};

function rowToSession(row: {
  context_json: string;
  turn: number;
  messages_json: string;
}): CallSession {
  return {
    context: JSON.parse(row.context_json) as CallContext,
    turn: row.turn,
    messages: JSON.parse(row.messages_json) as OpenAI.Chat.ChatCompletionMessageParam[],
  };
}

function persistSession(callSid: string, session: CallSession): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO call_sessions (call_sid, context_json, turn, messages_json, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(call_sid) DO UPDATE SET
       context_json = excluded.context_json,
       turn = excluded.turn,
       messages_json = excluded.messages_json,
       updated_at = excluded.updated_at`,
  ).run(
    callSid,
    JSON.stringify(session.context),
    session.turn,
    JSON.stringify(session.messages),
  );
}

export function createCallSession(
  callSid: string,
  context: CallContext,
  messages: OpenAI.Chat.ChatCompletionMessageParam[] = [],
): CallSession {
  const session: CallSession = { context, turn: 0, messages };
  persistSession(callSid, session);
  logCall("session.create", {
    callSid,
    meta: { contact: context.contactName, invoice: context.invoiceNumber },
  });
  return session;
}

export function getCallSession(callSid: string): CallSession | undefined {
  const row = getDb()
    .prepare(
      `SELECT context_json, turn, messages_json
       FROM call_sessions
       WHERE call_sid = ?`,
    )
    .get(callSid) as
    | { context_json: string; turn: number; messages_json: string }
    | undefined;

  return row ? rowToSession(row) : undefined;
}

/** Recover a live Twilio call after dev-server restart (in-memory map was lost). */
export function ensureCallSession(
  callSid: string,
  contextOverride?: CallContext,
): CallSession {
  const existing = getCallSession(callSid);
  if (existing) {
    if (
      contextOverride &&
      existing.context.contactName !== contextOverride.contactName &&
      existing.turn === 0
    ) {
      logCall("session.recover", {
        callSid,
        detail: "correcting session context after webhook race",
        meta: { from: existing.context.contactName, to: contextOverride.contactName },
      });
      const fixed: CallSession = {
        ...existing,
        context: contextOverride,
        messages: buildOpeningMessages(contextOverride),
      };
      saveCallSession(callSid, fixed);
      return fixed;
    }
    return existing;
  }

  const context = contextOverride ?? DEFAULT_CONTEXT;
  logCall("session.recover", {
    callSid,
    detail: "creating session from webhook",
    meta: { contact: context.contactName },
  });
  return createCallSession(
    callSid,
    context,
    buildOpeningMessages(context),
  );
}

export function saveCallSession(callSid: string, session: CallSession): void {
  persistSession(callSid, session);
  logCall("session.save", { callSid, meta: { turn: session.turn } });
}

export function deleteCallSession(callSid: string): void {
  getDb().prepare(`DELETE FROM call_sessions WHERE call_sid = ?`).run(callSid);
  logCall("session.delete", { callSid });
}
