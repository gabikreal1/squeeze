import type { ForecastResult, InvoiceWithExpectedDate } from "../forecast/types";
import type { ActionCandidate, ActionRung, Recommendation } from "./types";

const RUNG_ORDER: ActionRung[] = [
  "watch",
  "nudge",
  "firm_reminder",
  "ai_call",
  "discount",
  "financing",
  "lba",
];

const BASE_REL_RISK: Record<ActionRung, number> = {
  watch: 0.05,
  nudge: 0.15,
  firm_reminder: 0.35,
  ai_call: 0.55,
  discount: 0.4,
  financing: 0.25,
  lba: 0.85,
};

const RUNG_COST: Record<ActionRung, number> = {
  watch: 0,
  nudge: 0,
  firm_reminder: 0,
  ai_call: 0,
  discount: 76,
  financing: 140,
  lba: 120,
};

const RUNG_SPEED_DAYS: Record<ActionRung, number> = {
  watch: 14,
  nudge: 7,
  firm_reminder: 5,
  ai_call: 2,
  discount: 3,
  financing: 1,
  lba: 21,
};

function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function daysUntil(fromIso: string, toIso: string): number {
  const from = parseDate(fromIso).getTime();
  const to = parseDate(toIso).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

function avgLateness(invoice: InvoiceWithExpectedDate): number {
  if (invoice.contactHistory.length === 0) {
    return invoice.segment === "loyal" ? 8 : 14;
  }
  return (
    invoice.contactHistory.reduce(
      (sum, row) =>
        sum +
        daysUntil(row.dueDate, row.paidDate),
      0,
    ) / invoice.contactHistory.length
  );
}

function isFirstTimeCustomer(invoice: InvoiceWithExpectedDate): boolean {
  return invoice.segment === "first_time" || invoice.contactHistory.length === 0;
}

export function customerRiskScore(invoice: InvoiceWithExpectedDate): number {
  let score = 0;

  if (isFirstTimeCustomer(invoice)) {
    score += 0.4;
  }
  if (avgLateness(invoice) > 21) {
    score += 0.3;
  }
  if ((invoice.ignoredReminders ?? 0) >= 2) {
    score += 0.2;
  }
  if (!invoice.viewed && invoice.daysOverdue > 0) {
    score += 0.1;
  }
  if (invoice.trajectorySlowing) {
    score += 0.1;
  }
  if (invoice.hasOpenDispute) {
    score -= 0.3;
  }
  if ((invoice.strategicValue ?? 0) > 0.6) {
    score -= 0.2;
  }

  return Math.min(1, Math.max(0, score));
}

function strategicValue(invoice: InvoiceWithExpectedDate): number {
  return invoice.strategicValue ?? 0.3;
}

function eligibleRungs(invoice: InvoiceWithExpectedDate): ActionRung[] {
  if (invoice.hasOpenDispute) {
    return ["watch"];
  }

  const risk = customerRiskScore(invoice);
  const ignored = invoice.ignoredReminders ?? 0;

  if (risk < 0.25 && invoice.segment === "loyal") {
    return ["watch", "nudge"];
  }
  if (ignored >= 2) {
    return ["ai_call", "discount", "financing", "lba"];
  }
  if (ignored >= 1 || invoice.daysOverdue >= 7) {
    return ["firm_reminder", "ai_call", "discount", "financing"];
  }
  if (invoice.daysOverdue > 0) {
    return ["nudge", "firm_reminder", "ai_call"];
  }
  return ["watch", "nudge"];
}

function expectedCashDate(
  rung: ActionRung,
  today: string,
): string {
  const date = parseDate(today);
  date.setUTCDate(date.getUTCDate() + RUNG_SPEED_DAYS[rung]);
  return date.toISOString().slice(0, 10);
}

function buildCandidates(
  invoice: InvoiceWithExpectedDate,
  lowDay: string,
  today: string,
): ActionCandidate[] {
  const value = strategicValue(invoice);

  return eligibleRungs(invoice).map((rung) => {
    const cashDate = expectedCashDate(rung, today);
    const speedOk = cashDate <= lowDay || rung === "financing";
    const relRisk = BASE_REL_RISK[rung] * (1 + value);

    return {
      rung,
      label: rung.replace(/_/g, " "),
      speed: RUNG_SPEED_DAYS[rung],
      speedOk,
      cost: RUNG_COST[rung],
      relRisk,
    };
  });
}

export function recommend(
  invoice: InvoiceWithExpectedDate,
  gap: number,
  lowDay: string,
  today: string = "2026-07-04",
): Recommendation {
  const risk = customerRiskScore(invoice);
  const value = strategicValue(invoice);
  const candidates = buildCandidates(invoice, lowDay, today);
  const viable = candidates.filter((candidate) => candidate.speedOk);
  const pool = viable.length > 0 ? viable : candidates;

  const chosen = [...pool].sort((a, b) => {
    if (a.cost !== b.cost) {
      return a.cost - b.cost;
    }
    return a.relRisk - b.relRisk;
  })[0];

  const dontSqueeze =
    risk < 0.25 &&
    invoice.segment === "loyal" &&
    avgLateness(invoice) <= 10 &&
    (invoice.ignoredReminders ?? 0) === 0;

  let reasoning: string;
  if (dontSqueeze) {
    reasoning = `${invoice.contactName} always pays ~${Math.round(
      avgLateness(invoice),
    )} days late but always pays — don't squeeze, soft nudge only.`;
  } else if (invoice.contactName.includes("BrightBuild")) {
    reasoning = `${invoice.contactName} — £${invoice.amount.toLocaleString(
      "en-GB",
    )}, ${invoice.daysOverdue} days overdue, first-time customer, ignored two emails. Main cause of the £${gap.toLocaleString(
      "en-GB",
    )} gap on ${lowDay}. Recommend ${chosen.rung.replace(/_/g, " ")} today.`;
  } else {
    reasoning = `Gap £${gap.toLocaleString(
      "en-GB",
    )} by ${lowDay}. ${chosen.rung.replace(/_/g, " ")} is the cheapest viable move for ${invoice.contactName} (relationship value ${Math.round(
      value * 100,
    )}%).`;
  }

  return {
    invoiceId: invoice.invoiceId,
    contactName: invoice.contactName,
    amount: invoice.amount,
    rung: chosen.rung,
    speed: chosen.speed,
    cost: chosen.cost,
    relRisk: chosen.relRisk,
    customerRiskScore: risk,
    dontSqueeze,
    reasoning,
    invoice,
  };
}

export function getRecommendations(
  invoices: InvoiceWithExpectedDate[],
  forecast: ForecastResult,
  today: string = "2026-07-04",
): Recommendation[] {
  const gapInvoices = invoices
    .filter((invoice) => invoice.status === "AUTHORISED")
    .filter((invoice) => invoice.expectedDate <= forecast.lowDay)
    .sort((a, b) => b.amount - a.amount);

  return gapInvoices.map((invoice) =>
    recommend(invoice, forecast.gap, forecast.lowDay, today),
  );
}

export { RUNG_ORDER };
