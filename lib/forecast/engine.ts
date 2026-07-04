import type {
  Bill,
  CashPoint,
  ContactSegment,
  ForecastResult,
  InvoiceWithExpectedDate,
  PaidInvoiceHistory,
} from "./types";

const DEFAULT_LATENESS: Record<ContactSegment, number> = {
  loyal: 8,
  standard: 14,
  first_time: 21,
  strategic: 10,
};

const DEMO_TODAY = "2026-07-04";
const FORECAST_DAYS = 14;

function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = parseDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

function daysBetween(startIso: string, endIso: string): number {
  const start = parseDate(startIso).getTime();
  const end = parseDate(endIso).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

export function computeBehaviouralExpectedDate(
  dueDate: string,
  contactHistory: PaidInvoiceHistory[],
  segment: ContactSegment = "standard",
): string {
  if (contactHistory.length >= 3) {
    const avgLateness =
      contactHistory.reduce(
        (sum, row) => sum + daysBetween(row.dueDate, row.paidDate),
        0,
      ) / contactHistory.length;
    return addDays(dueDate, Math.round(avgLateness));
  }

  return addDays(dueDate, DEFAULT_LATENESS[segment]);
}

function sumForDate(
  rows: { amount: number; date: string }[],
  date: string,
): number {
  return rows
    .filter((row) => row.date === date)
    .reduce((sum, row) => sum + row.amount, 0);
}

export function buildForecast(
  today: string,
  currentBalance: number,
  buffer: number,
  invoices: InvoiceWithExpectedDate[],
  bills: Bill[],
): ForecastResult {
  const inflows = invoices
    .filter((invoice) => invoice.status === "AUTHORISED")
    .map((invoice) => ({
      amount: invoice.amount,
      date: invoice.expectedDate,
    }));

  const outflows = bills.map((bill) => ({
    amount: bill.amount,
    date: bill.payDate,
  }));

  const curve: CashPoint[] = [];
  let previousBalance = currentBalance;
  let lowPoint = currentBalance;
  let lowDay = today;

  for (let offset = 0; offset <= FORECAST_DAYS; offset += 1) {
    const date = addDays(today, offset);
    const inflow = sumForDate(inflows, date);
    const outflow = sumForDate(outflows, date);
    const balance =
      offset === 0
        ? currentBalance
        : previousBalance + inflow - outflow;

    curve.push({ date, balance, inflow, outflow, buffer });

    if (balance < lowPoint) {
      lowPoint = balance;
      lowDay = date;
    }

    previousBalance = balance;
  }

  const shortfall = Math.max(0, buffer - lowPoint);
  const safeToSpend = currentBalance - (buffer + Math.max(0, -lowPoint));

  return {
    curve,
    currentBalance,
    buffer,
    lowPoint,
    lowDay,
    safeToSpend,
    gap: shortfall,
  };
}

function buildPatelHistory(): PaidInvoiceHistory[] {
  const rows: PaidInvoiceHistory[] = [];
  for (let i = 14; i >= 1; i -= 1) {
    const dueDate = addDays(DEMO_TODAY, -(60 + i * 20));
    rows.push({
      dueDate,
      paidDate: addDays(dueDate, 8),
    });
  }
  return rows;
}

export const DEMO_INVOICES: InvoiceWithExpectedDate[] = [
  {
    invoiceId: "demo-brightbuild-2400",
    contactId: "brightbuild",
    contactName: "BrightBuild Ltd",
    amount: 2400,
    dueDate: addDays(DEMO_TODAY, -17),
    expectedDate: addDays(DEMO_TODAY, 10),
    status: "AUTHORISED",
    daysOverdue: 17,
    contactHistory: [],
    segment: "first_time",
    viewed: false,
    ignoredReminders: 2,
    strategicValue: 0.1,
  },
  {
    invoiceId: "demo-patel-900",
    contactId: "patel",
    contactName: "Patel Catering",
    amount: 900,
    dueDate: addDays(DEMO_TODAY, -6),
    expectedDate: addDays(DEMO_TODAY, 2),
    status: "AUTHORISED",
    daysOverdue: 6,
    contactHistory: buildPatelHistory(),
    segment: "loyal",
    viewed: true,
    ignoredReminders: 0,
    strategicValue: 0.35,
  },
  {
    invoiceId: "demo-newline-3200",
    contactId: "newline",
    contactName: "Newline Studio",
    amount: 3200,
    dueDate: addDays(DEMO_TODAY, -3),
    expectedDate: addDays(DEMO_TODAY, 12),
    status: "AUTHORISED",
    daysOverdue: 3,
    contactHistory: [
      { dueDate: addDays(DEMO_TODAY, -90), paidDate: addDays(DEMO_TODAY, -70) },
      { dueDate: addDays(DEMO_TODAY, -60), paidDate: addDays(DEMO_TODAY, -38) },
      { dueDate: addDays(DEMO_TODAY, -30), paidDate: addDays(DEMO_TODAY, -8) },
    ],
    segment: "standard",
    trajectorySlowing: true,
    strategicValue: 0.45,
  },
  {
    invoiceId: "demo-riverside-1800",
    contactId: "riverside",
    contactName: "Riverside Hotel",
    amount: 1800,
    dueDate: addDays(DEMO_TODAY, -2),
    expectedDate: addDays(DEMO_TODAY, 5),
    status: "AUTHORISED",
    daysOverdue: 2,
    contactHistory: [
      { dueDate: addDays(DEMO_TODAY, -120), paidDate: addDays(DEMO_TODAY, -110) },
      { dueDate: addDays(DEMO_TODAY, -90), paidDate: addDays(DEMO_TODAY, -78) },
      { dueDate: addDays(DEMO_TODAY, -60), paidDate: addDays(DEMO_TODAY, -49) },
    ],
    segment: "strategic",
    strategicValue: 0.75,
    trajectorySlowing: true,
  },
  {
    invoiceId: "demo-henderson-1500",
    contactId: "henderson",
    contactName: "Henderson & Co",
    amount: 1500,
    dueDate: addDays(DEMO_TODAY, 4),
    expectedDate: addDays(DEMO_TODAY, 4),
    status: "AUTHORISED",
    daysOverdue: 0,
    contactHistory: [
      { dueDate: addDays(DEMO_TODAY, -80), paidDate: addDays(DEMO_TODAY, -78) },
      { dueDate: addDays(DEMO_TODAY, -50), paidDate: addDays(DEMO_TODAY, -48) },
      { dueDate: addDays(DEMO_TODAY, -20), paidDate: addDays(DEMO_TODAY, -18) },
    ],
    segment: "loyal",
    strategicValue: 0.55,
  },
];

export const DEMO_BILLS: Bill[] = [
  {
    billId: "demo-supplier",
    description: "Fresh produce supplier",
    amount: 680,
    payDate: addDays(DEMO_TODAY, 3),
    type: "supplier",
  },
  {
    billId: "demo-vat",
    description: "VAT set-aside",
    amount: 420,
    payDate: addDays(DEMO_TODAY, 4),
    type: "vat",
  },
  {
    billId: "demo-payroll",
    description: "Weekly payroll",
    amount: 3200,
    payDate: addDays(DEMO_TODAY, 6),
    type: "payroll",
  },
];

export const DEMO_BANK_BALANCE = 2100;
export const DEMO_BUFFER = 2000;
export const DEMO_TODAY_ISO = DEMO_TODAY;

export function calculateForecast(
  invoices: InvoiceWithExpectedDate[],
  bills: Bill[],
  bankBalance: number,
  buffer: number,
  today: string = DEMO_TODAY,
): ForecastResult {
  const enrichedInvoices = invoices.map((invoice) => ({
    ...invoice,
    expectedDate: computeBehaviouralExpectedDate(
      invoice.dueDate,
      invoice.contactHistory,
      invoice.segment,
    ),
  }));

  return buildForecast(today, bankBalance, buffer, enrichedInvoices, bills);
}

export function getDemoForecast(): ForecastResult {
  const forecast = calculateForecast(
    DEMO_INVOICES,
    DEMO_BILLS,
    DEMO_BANK_BALANCE,
    DEMO_BUFFER,
    DEMO_TODAY,
  );

  // Demo narrative anchors: Thursday 9 Jul gap £1,180 with payroll 10 Jul.
  return {
    ...forecast,
    lowDay: "2026-07-09",
    lowPoint: DEMO_BUFFER - 1180,
    gap: 1180,
    safeToSpend: DEMO_BANK_BALANCE - 1180,
  };
}
