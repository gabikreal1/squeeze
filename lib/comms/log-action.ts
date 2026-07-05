import { getDb } from "../db/client";
import type { ActionRung } from "../decision/types";

function ensureActionsTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_name TEXT NOT NULL,
      invoice_id TEXT,
      rung TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'logged',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(contact_name, rung, invoice_id)
    );
  `);
}

export function logOutboundMessage(input: {
  contactName: string;
  invoiceId?: string;
  rung: ActionRung;
  channel: "whatsapp";
  messageSid: string;
  body: string;
}): void {
  ensureActionsTable();
  getDb()
    .prepare(
      `INSERT INTO actions (contact_name, invoice_id, rung, status, notes)
       VALUES (?, ?, ?, 'sent', ?)
       ON CONFLICT(contact_name, rung, invoice_id) DO UPDATE SET
         status = excluded.status,
         notes = excluded.notes,
         created_at = datetime('now')`,
    )
    .run(
      input.contactName,
      input.invoiceId ?? null,
      input.rung,
      `${input.channel} · ${input.messageSid} · ${input.body.slice(0, 240)}`,
    );
}
