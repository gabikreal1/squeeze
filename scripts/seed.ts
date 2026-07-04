import "dotenv/config";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { Invoice, Contact, XeroClient } from "xero-node";
import { runMigrations } from "../lib/db/client";
import { getDemoForecast } from "../lib/forecast";
import {
  ensureAuthenticated,
  getTenantId,
  isXeroConnected,
} from "../lib/xero/client";

type ActionRow = {
  contact_name: string;
  invoice_id: string | null;
  rung: string;
  status: string;
  notes: string;
};

const EXTRA_CONTACTS = [
  "Maple Events Ltd",
  "GreenTable Co-op",
  "Summit Logistics",
  "Coastal Kitchens",
  "Artisan Prints",
] as const;

const PRIMARY_CONTACTS = [
  {
    name: "Patel Catering",
    personality: "loyal",
    email: "accounts@patelcatering.example",
  },
  {
    name: "BrightBuild Ltd",
    personality: "ghoster",
    email: "ap@brightbuild.example",
  },
  {
    name: "Henderson & Co",
    personality: "treasury",
    email: "finance@henderson.example",
  },
  {
    name: "Newline Studio",
    personality: "slow",
    email: "billing@newline.example",
  },
  {
    name: "Riverside Hotel",
    personality: "strategic",
    email: "accounts@riversidehotel.example",
  },
] as const;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}


function ensureSqliteSchema(db: Database.Database): void {
  db.exec(`
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

function seedLocalActions(db: Database.Database): number {
  ensureSqliteSchema(db);

  const insert = db.prepare(`
    INSERT INTO actions (contact_name, invoice_id, rung, status, notes)
    VALUES (@contact_name, @invoice_id, @rung, @status, @notes)
    ON CONFLICT(contact_name, rung, invoice_id) DO UPDATE SET
      status = excluded.status,
      notes = excluded.notes
  `);

  const rows: ActionRow[] = [
    {
      contact_name: "BrightBuild Ltd",
      invoice_id: "demo-brightbuild-2400",
      rung: "nudge",
      status: "sent",
      notes: "Polite payment reminder email — no response",
    },
    {
      contact_name: "BrightBuild Ltd",
      invoice_id: "demo-brightbuild-2400",
      rung: "firm_reminder",
      status: "sent",
      notes: "Firm reminder sent — still ignored (2 emails total)",
    },
    {
      contact_name: "Patel Catering",
      invoice_id: "demo-patel-900",
      rung: "nudge",
      status: "planned",
      notes: "Soft nudge only — loyal payer, always ~8 days late",
    },
  ];

  for (const row of rows) {
    insert.run(row);
  }

  return rows.length;
}

async function findContactByName(
  xero: XeroClient,
  tenantId: string,
  name: string,
): Promise<Contact | undefined> {
  const where = `Name=="${name.replace(/"/g, '\\"')}"`;
  const response = await xero.accountingApi.getContacts(
    tenantId,
    undefined,
    where,
  );
  return response.body.contacts?.[0];
}

async function upsertContact(
  xero: XeroClient,
  tenantId: string,
  name: string,
  email: string,
): Promise<Contact> {
  const existing = await findContactByName(xero, tenantId, name);
  if (existing?.contactID) {
    return existing;
  }

  const created = await xero.accountingApi.createContacts(tenantId, {
    contacts: [
      {
        name,
        emailAddress: email,
        isCustomer: true,
        isSupplier: name.includes("supplier") ? true : undefined,
      },
    ],
  });

  return created.body.contacts?.[0] ?? { name };
}

async function seedXeroContacts(
  xero: XeroClient,
  tenantId: string,
): Promise<Map<string, Contact>> {
  const contacts = new Map<string, Contact>();

  for (const contact of PRIMARY_CONTACTS) {
    const saved = await upsertContact(
      xero,
      tenantId,
      contact.name,
      contact.email,
    );
    contacts.set(contact.name, saved);
  }

  for (const name of EXTRA_CONTACTS) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const saved = await upsertContact(
      xero,
      tenantId,
      name,
      `accounts@${slug}.example`,
    );
    contacts.set(name, saved);
  }

  return contacts;
}

async function getOrgAccountCodes(
  xero: XeroClient,
  tenantId: string,
): Promise<{ revenue: string; expense: string; taxType: string }> {
  const accountsRes = await xero.accountingApi.getAccounts(tenantId);
  const accounts = accountsRes.body.accounts ?? [];

  const revenue =
    accounts.find((a) => a.type?.toString() === "REVENUE")?.code ??
    accounts.find((a) => a.code?.startsWith("2"))?.code ??
    "200";

  const expense =
    accounts.find((a) => a.type?.toString() === "EXPENSE")?.code ??
    accounts.find((a) => a.type?.toString() === "DIRECTCOSTS")?.code ??
    accounts.find((a) => a.code?.startsWith("4"))?.code ??
    "400";

  const taxRes = await xero.accountingApi.getTaxRates(tenantId);
  const taxRates = taxRes.body.taxRates ?? [];
  const taxType =
    taxRates.find((t) => t.status?.toString() === "ACTIVE" && t.canApplyToExpenses)?.taxType ??
    taxRates.find((t) => t.status?.toString() === "ACTIVE")?.taxType ??
    "NONE";

  return { revenue, expense, taxType };
}

async function seedXeroInvoices(
  xero: XeroClient,
  tenantId: string,
  contacts: Map<string, Contact>,
  today: Date,
): Promise<{ receivables: number; bills: number }> {
  const { revenue, expense, taxType } = await getOrgAccountCodes(xero, tenantId);
  const brightBuild = contacts.get("BrightBuild Ltd");
  const patel = contacts.get("Patel Catering");
  const newline = contacts.get("Newline Studio");
  const riverside = contacts.get("Riverside Hotel");
  const henderson = contacts.get("Henderson & Co");

  const receivablePayload: Invoice[] = [
    {
      type: Invoice.TypeEnum.ACCREC,
      contact: { contactID: brightBuild?.contactID },
      lineItems: [
        {
          description: "Event marquee install — BrightBuild",
          quantity: 1,
          unitAmount: 2400,
          accountCode: revenue,
          taxType,
        },
      ],
      date: isoDate(addDays(today, -20)),
      dueDate: isoDate(addDays(today, -17)),
      status: Invoice.StatusEnum.AUTHORISED,
      invoiceNumber: "SQZ-BB-2400",
    },
    {
      type: Invoice.TypeEnum.ACCREC,
      contact: { contactID: patel?.contactID },
      lineItems: [
        {
          description: "Corporate lunch catering",
          quantity: 1,
          unitAmount: 900,
          accountCode: revenue,
          taxType,
        },
      ],
      date: isoDate(addDays(today, -12)),
      dueDate: isoDate(addDays(today, -6)),
      status: Invoice.StatusEnum.AUTHORISED,
      invoiceNumber: "SQZ-PAT-900",
    },
    {
      type: Invoice.TypeEnum.ACCREC,
      contact: { contactID: newline?.contactID },
      lineItems: [
        {
          description: "Brand shoot catering",
          quantity: 1,
          unitAmount: 3200,
          accountCode: revenue,
          taxType,
        },
      ],
      date: isoDate(addDays(today, -8)),
      dueDate: isoDate(addDays(today, -3)),
      status: Invoice.StatusEnum.AUTHORISED,
      invoiceNumber: "SQZ-NL-3200",
    },
    {
      type: Invoice.TypeEnum.ACCREC,
      contact: { contactID: riverside?.contactID },
      lineItems: [
        {
          description: "Hotel breakfast service",
          quantity: 1,
          unitAmount: 1800,
          accountCode: revenue,
          taxType,
        },
      ],
      date: isoDate(addDays(today, -10)),
      dueDate: isoDate(addDays(today, -2)),
      status: Invoice.StatusEnum.AUTHORISED,
      invoiceNumber: "SQZ-RH-1800",
    },
    {
      type: Invoice.TypeEnum.ACCREC,
      contact: { contactID: henderson?.contactID },
      lineItems: [
        {
          description: "Office lunch contract",
          quantity: 1,
          unitAmount: 1500,
          accountCode: revenue,
          taxType,
        },
      ],
      date: isoDate(addDays(today, -5)),
      dueDate: isoDate(addDays(today, 4)),
      status: Invoice.StatusEnum.AUTHORISED,
      invoiceNumber: "SQZ-HC-1500",
    },
  ];

  const billPayload: Invoice[] = [
    {
      type: Invoice.TypeEnum.ACCPAY,
      contact: { name: "Fresh Produce Supplier" },
      lineItems: [
        {
          description: "Weekly produce delivery",
          quantity: 1,
          unitAmount: 680,
          accountCode: expense,
          taxType,
        },
      ],
      date: isoDate(today),
      dueDate: isoDate(addDays(today, 3)),
      status: Invoice.StatusEnum.AUTHORISED,
      invoiceNumber: "SQZ-BILL-SUP",
    },
    {
      type: Invoice.TypeEnum.ACCPAY,
      contact: { name: "HMRC VAT Set-aside" },
      lineItems: [
        {
          description: "VAT set-aside transfer",
          quantity: 1,
          unitAmount: 420,
          accountCode: expense,
          taxType,
        },
      ],
      date: isoDate(today),
      dueDate: isoDate(addDays(today, 4)),
      status: Invoice.StatusEnum.AUTHORISED,
      invoiceNumber: "SQZ-BILL-VAT",
    },
    {
      type: Invoice.TypeEnum.ACCPAY,
      contact: { name: "Payroll Clearing" },
      lineItems: [
        {
          description: "Weekly payroll run",
          quantity: 1,
          unitAmount: 3200,
          accountCode: expense,
          taxType,
        },
      ],
      date: isoDate(today),
      dueDate: isoDate(addDays(today, 5)),
      status: Invoice.StatusEnum.AUTHORISED,
      invoiceNumber: "SQZ-BILL-PAY",
    },
  ];

  let receivables = 0;
  let bills = 0;

  for (const invoice of receivablePayload) {
    const number = invoice.invoiceNumber ?? "";
    const existing = await xero.accountingApi.getInvoices(
      tenantId,
      undefined,
      `InvoiceNumber=="${number}"`,
    );
    if ((existing.body.invoices?.length ?? 0) > 0) {
      continue;
    }
    await xero.accountingApi.createInvoices(tenantId, { invoices: [invoice] });
    receivables += 1;
  }

  for (const bill of billPayload) {
    const number = bill.invoiceNumber ?? "";
    const existing = await xero.accountingApi.getInvoices(
      tenantId,
      undefined,
      `InvoiceNumber=="${number}"`,
    );
    if ((existing.body.invoices?.length ?? 0) > 0) {
      continue;
    }
    await xero.accountingApi.createInvoices(tenantId, { invoices: [bill] });
    bills += 1;
  }

  return { receivables, bills };
}

async function main(): Promise<void> {
  runMigrations();

  const today = new Date();
  const dbPath =
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "squeeze.db");

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);

  const summary: string[] = [];
  summary.push(`SQLite: ${dbPath}`);

  const actionCount = seedLocalActions(db);
  summary.push(`SQLite actions seeded/updated: ${actionCount}`);

  if (!isXeroConnected()) {
    summary.push("Xero: skipped (not connected — open /api/xero/connect)");
    summary.push("Mode: local SQLite demo actions only");
  } else {
    try {
      const xero = await ensureAuthenticated();
      const tenantId = getTenantId();
      const contacts = await seedXeroContacts(xero, tenantId);
      const { receivables, bills } = await seedXeroInvoices(
        xero,
        tenantId,
        contacts,
        today,
      );

      summary.push(`Xero tenant: ${tenantId}`);
      summary.push(`Xero contacts ready: ${contacts.size}`);
      summary.push(`Xero receivables created: ${receivables}`);
      summary.push(`Xero ACCPAY bills created: ${bills}`);
      summary.push(
        `Relative schedule from ${isoDate(today)}: supplier +3d, VAT +4d, payroll +5d`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.push(`Xero: failed (${message}) — SQLite actions still seeded`);
    }
  }

  const forecast = getDemoForecast();
  summary.push(
    `Demo forecast anchor: gap £${forecast.gap.toLocaleString("en-GB")}, low day ${forecast.lowDay}`,
  );
  summary.push(
    "Narrative: BrightBuild ignored 2 emails → AI call; Patel soft nudge only",
  );

  console.log("\nSqueeze seed complete\n" + summary.map((line) => `  • ${line}`).join("\n") + "\n");

  db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
