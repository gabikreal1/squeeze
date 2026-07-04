import type { Invoice } from "xero-node";
import { getDb } from "../db/client";
import {
  getBankBalance,
  getBills,
  getInvoices,
  getOrganisations,
  isXeroConnected,
} from "../xero/client";
import {
  calculateForecast,
  computeBehaviouralExpectedDate,
} from "./engine";
import type {
  Bill,
  ContactSegment,
  InvoiceWithExpectedDate,
  PaidInvoiceHistory,
} from "./types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseXeroDate(value: string | Date | undefined): string {
  if (!value) return todayIso();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const match = /\/Date\((\d+)/.exec(value);
  if (match) {
    return new Date(Number(match[1])).toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`).getTime();
  const end = new Date(`${endIso}T00:00:00Z`).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function inferSegment(contactName: string): ContactSegment {
  const name = contactName.toLowerCase();
  if (name.includes("patel") || name.includes("henderson")) return "loyal";
  if (name.includes("brightbuild")) return "first_time";
  if (name.includes("riverside") || name.includes("hotel")) return "strategic";
  return "standard";
}

function loadIgnoredReminderCount(contactName: string): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM actions
       WHERE contact_name = ?
       AND rung IN ('nudge', 'firm_reminder')
       AND status = 'sent'`,
    )
    .get(contactName) as { count: number } | undefined;
  return row?.count ?? 0;
}

function loadSimulatedPaidInvoices(): Map<string, number> {
  const db = getDb();
  const row = db
    .prepare(`SELECT value FROM settings WHERE key = 'simulated_paid_invoices'`)
    .get() as { value: string } | undefined;
  if (!row) return new Map();
  try {
    const parsed = JSON.parse(row.value) as Record<string, number> | string[];
    if (Array.isArray(parsed)) {
      return new Map(parsed.map((invoiceNumber) => [invoiceNumber, 0]));
    }
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

export function markInvoicePaidSimulated(
  invoiceNumber: string,
  amount: number,
): void {
  const db = getDb();
  const current = Object.fromEntries(loadSimulatedPaidInvoices());
  current[invoiceNumber] = amount;
  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('simulated_paid_invoices', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(JSON.stringify(current));
}

export function isDemoHealApplied(): boolean {
  const db = getDb();
  const row = db
    .prepare(`SELECT value FROM settings WHERE key = 'demo_heal_applied'`)
    .get() as { value: string } | undefined;
  return row?.value === "true";
}

export function markDemoHealApplied(): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('demo_heal_applied', 'true')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run();
}

export function resetDemoHealState(): void {
  const db = getDb();
  db.prepare(`DELETE FROM settings WHERE key IN ('simulated_paid_invoices', 'demo_heal_applied')`).run();
}

export function getSimulatedPaymentTotal(): number {
  return [...loadSimulatedPaidInvoices().values()].reduce(
    (sum, amount) => sum + amount,
    0,
  );
}

function invoiceAmount(invoice: Invoice): number {
  return invoice.amountDue ?? invoice.total ?? 0;
}

function buildContactHistory(
  contactName: string,
  paidInvoices: Invoice[],
): PaidInvoiceHistory[] {
  return paidInvoices
    .filter((inv) => inv.contact?.name === contactName)
    .slice(0, 12)
    .map((inv) => ({
      dueDate: parseXeroDate(inv.dueDate as string),
      paidDate: parseXeroDate(
        (inv.fullyPaidOnDate as string) ?? (inv.dueDate as string),
      ),
    }));
}

function classifyBill(description: string, contactName: string): Bill["type"] {
  const text = `${description} ${contactName}`.toLowerCase();
  if (text.includes("payroll")) return "payroll";
  if (text.includes("vat")) return "vat";
  if (text.includes("supplier") || text.includes("produce")) return "supplier";
  return "other";
}

export type LiveForecastInput = {
  today: string;
  orgName: string;
  invoices: InvoiceWithExpectedDate[];
  bills: Bill[];
  bankBalance: number;
  buffer: number;
};

export async function loadLiveForecastInput(): Promise<LiveForecastInput | null> {
  if (!isXeroConnected()) return null;

  const today = todayIso();
  const buffer = Number(process.env.SAFETY_BUFFER ?? 2000);
  const simulatedPaid = loadSimulatedPaidInvoices();
  const simulatedPaymentTotal = [...simulatedPaid.values()].reduce(
    (sum, amount) => sum + amount,
    0,
  );

  try {
    const [orgs, receivables, payables, bankBalance] = await Promise.all([
      getOrganisations(),
      getInvoices(),
      getBills(),
      getBankBalance(),
    ]);

  const paidHistory = receivables.filter(
    (inv) => inv.status?.toString() === "PAID",
  );

  const invoices: InvoiceWithExpectedDate[] = receivables
    .filter(
      (inv) =>
        inv.status?.toString() === "AUTHORISED" &&
        !simulatedPaid.has(inv.invoiceNumber ?? "") &&
        invoiceAmount(inv) > 0,
    )
    .map((inv) => {
      const contactName = inv.contact?.name ?? "Unknown";
      const dueDate = parseXeroDate(inv.dueDate as string);
      const segment = inferSegment(contactName);
      const history = buildContactHistory(contactName, paidHistory);
      const expectedDate = computeBehaviouralExpectedDate(
        dueDate,
        history,
        segment,
      );

      return {
        invoiceId: inv.invoiceNumber ?? inv.invoiceID ?? contactName,
        contactId: contactName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        contactName,
        amount: invoiceAmount(inv),
        dueDate,
        expectedDate,
        status: "AUTHORISED" as const,
        daysOverdue: Math.max(0, daysBetween(dueDate, today)),
        contactHistory: history,
        segment,
        ignoredReminders: loadIgnoredReminderCount(contactName),
        strategicValue: segment === "strategic" ? 0.75 : 0.3,
        trajectorySlowing: segment === "strategic",
      };
    });

  const bills: Bill[] = payables
    .filter(
      (bill) =>
        bill.status?.toString() === "AUTHORISED" && invoiceAmount(bill) > 0,
    )
    .map((bill) => {
      const description =
        bill.lineItems?.[0]?.description ?? bill.reference ?? "Bill";
      const contactName = bill.contact?.name ?? "Supplier";
      return {
        billId: bill.invoiceID ?? bill.invoiceNumber ?? description,
        description,
        amount: invoiceAmount(bill),
        payDate: parseXeroDate(bill.dueDate as string),
        type: classifyBill(description, contactName),
      };
    });

  return {
    today,
    orgName: orgs[0]?.name ?? "Xero organisation",
    invoices,
    bills,
    bankBalance: bankBalance + simulatedPaymentTotal,
    buffer,
  };
  } catch (error) {
    console.warn(
      "[xero] live forecast unavailable:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function buildLiveForecast() {
  const input = await loadLiveForecastInput();
  if (!input) return null;

  const forecast = calculateForecast(
    input.invoices,
    input.bills,
    input.bankBalance,
    input.buffer,
    input.today,
  );

  return { input, forecast };
}
