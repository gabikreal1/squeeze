import type { TokenSet } from "xero-node";
import { getDb } from "../db/client";

const TOKEN_KEY = "xero_token_set";
const TENANT_KEY = "xero_tenant_id";

export function saveXeroTokenSet(tokenSet: TokenSet): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(TOKEN_KEY, JSON.stringify(tokenSet));
}

export function loadXeroTokenSet(): TokenSet | null {
  const row = getDb()
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(TOKEN_KEY) as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as TokenSet;
  } catch {
    return null;
  }
}

export function saveXeroTenantId(tenantId: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(TENANT_KEY, tenantId);
}

export function loadXeroTenantId(): string | null {
  const row = getDb()
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(TENANT_KEY) as { value: string } | undefined;
  return row?.value?.trim() || null;
}

export function patchEnvTenantId(tenantId: string): void {
  saveXeroTenantId(tenantId);
}
