import { getRecommendations } from "../decision";
import type { Recommendation } from "../decision/types";
import {
  DEMO_INVOICES,
  getDemoForecast,
  type ForecastResult,
} from "../forecast";
import type { InvoiceWithExpectedDate } from "../forecast/types";
import {
  buildLiveForecast,
  getSimulatedPaymentTotal,
  isDemoHealApplied,
  isDemoReplayActive,
} from "../forecast/xero-loader";

export type ApiForecastAction = {
  id: string;
  customer: string;
  invoiceAmount: number;
  invoiceNumber?: string;
  summary: string;
  recommendation: string;
  speed: "low" | "medium" | "high";
  cost: "low" | "medium" | "high";
  relationshipRisk: "low" | "medium" | "high";
  accent?: "lemon" | "danger" | "neutral";
  actionLabel?: string;
  messageRung?: "nudge" | "firm_reminder";
  contactPhone?: string;
  dontSqueeze?: boolean;
  daysOverdue: number;
  expectedDate: string;
};

export type ApiOutflow = {
  date: string;
  label: string;
  amount: number;
  type: string;
};

export type ApiGapDriver = {
  contact: string;
  amount: number;
  expectedDate: string;
  daysOverdue: number;
  invoiceNumber?: string;
};

export type ApiForecastResponse = {
  safeToSpend: number;
  currentBalance: number;
  buffer: number;
  gap?: { amount: number; dayLabel: string; date: string };
  timeline: {
    date: string;
    label: string;
    balance: number;
    buffer: number;
    inflow?: number;
    outflow?: number;
    isLowDay?: boolean;
  }[];
  actions: ApiForecastAction[];
  outflows: ApiOutflow[];
  gapDrivers: ApiGapDriver[];
  source: "xero" | "demo";
  orgName?: string;
  demo: boolean;
  lowDay: string;
  unpaidReceivables: number;
  unpaidPayables: number;
  paymentReceived?: number;
  gapClosed?: boolean;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabel(iso: string): string {
  const date = new Date(`${iso}T12:00:00.000Z`);
  return WEEKDAYS[date.getUTCDay()] ?? iso.slice(5);
}

function formatDayDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00.000Z`);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function level(
  value: number,
  lowMax: number,
  mediumMax: number,
): "low" | "medium" | "high" {
  if (value <= lowMax) return "low";
  if (value <= mediumMax) return "medium";
  return "high";
}

function formatAction(rec: Recommendation): ApiForecastAction {
  const invoice = rec.invoice;
  const summaryParts = [
    invoice.daysOverdue > 0 ? `${invoice.daysOverdue} days overdue` : "due soon",
    invoice.segment === "first_time" ? "first-time customer" : null,
    (invoice.ignoredReminders ?? 0) >= 2
      ? `ignored ${invoice.ignoredReminders} emails`
      : null,
    invoice.segment === "loyal" ? "always pays late, always pays" : null,
    `expected ${dayLabel(invoice.expectedDate)}`,
  ].filter(Boolean);

  const accent = rec.dontSqueeze
    ? "lemon"
    : rec.rung === "ai_call" || rec.rung === "lba"
      ? "danger"
      : "neutral";

  return {
    id: invoice.contactId,
    customer: rec.contactName,
    invoiceAmount: rec.amount,
    invoiceNumber: invoice.invoiceId,
    contactPhone: invoice.contactPhone,
    daysOverdue: invoice.daysOverdue,
    expectedDate: invoice.expectedDate,
    summary: summaryParts.join(" · "),
    recommendation: rec.reasoning,
    speed: level(rec.speed, 3, 7),
    cost: level(rec.cost, 0, 80),
    relationshipRisk: level(rec.relRisk, 0.35, 0.6),
    accent,
    dontSqueeze: rec.dontSqueeze,
    messageRung:
      rec.rung === "nudge" || rec.rung === "firm_reminder" ? rec.rung : undefined,
    actionLabel:
      rec.dontSqueeze
        ? "Send soft nudge"
        : rec.rung === "watch"
          ? undefined
          : rec.rung === "ai_call"
            ? "AI call"
            : rec.rung === "nudge"
              ? "Send WhatsApp nudge"
              : rec.rung === "firm_reminder"
                ? "Send firm reminder"
                : rec.rung.replace(/_/g, " "),
  };
}

function buildTimeline(forecast: ForecastResult) {
  return forecast.curve.map((point) => ({
    date: point.date,
    label: dayLabel(point.date),
    balance: Math.round(point.balance),
    buffer: forecast.buffer,
    inflow: Math.round(point.inflow),
    outflow: Math.round(point.outflow),
    isLowDay: point.date === forecast.lowDay,
  }));
}

function buildGapDrivers(
  invoices: InvoiceWithExpectedDate[],
  forecast: ForecastResult,
): ApiGapDriver[] {
  // Gap drivers = receivables that land ON or AFTER the low day, i.e. money that
  // arrives too late to prevent the shortfall. Most-overdue first.
  return invoices
    .filter(
      (inv) =>
        inv.status === "AUTHORISED" && inv.expectedDate >= forecast.lowDay,
    )
    .sort((a, b) => b.daysOverdue - a.daysOverdue || b.amount - a.amount)
    .slice(0, 6)
    .map((inv) => ({
      contact: inv.contactName,
      amount: inv.amount,
      expectedDate: inv.expectedDate,
      daysOverdue: inv.daysOverdue,
      invoiceNumber: inv.invoiceId,
    }));
}

function rankActions(
  invoices: InvoiceWithExpectedDate[],
  forecast: ForecastResult,
  today: string,
): ApiForecastAction[] {
  const recs = getRecommendations(invoices, forecast, today);
  const sorted = [...recs].sort((a, b) => {
    if (a.dontSqueeze !== b.dontSqueeze) return a.dontSqueeze ? 1 : -1;
    if (a.rung === "ai_call" && b.rung !== "ai_call") return -1;
    if (b.rung === "ai_call" && a.rung !== "ai_call") return 1;
    return b.amount - a.amount;
  });
  return sorted.slice(0, 8).map(formatAction);
}

function buildResponse(
  forecast: ForecastResult,
  invoices: InvoiceWithExpectedDate[],
  actions: ApiForecastAction[],
  options: {
    source: "xero" | "demo";
    orgName?: string;
    today: string;
  },
): ApiForecastResponse {
  const outflows = invoices.length
    ? buildOutflowsFromForecast(forecast, invoices)
    : [];

  return {
    safeToSpend: Math.round(forecast.safeToSpend),
    currentBalance: Math.round(forecast.currentBalance),
    buffer: forecast.buffer,
    gap:
      forecast.gap > 0
        ? {
            amount: Math.round(forecast.gap),
            dayLabel: dayLabel(forecast.lowDay),
            date: formatDayDate(forecast.lowDay),
          }
        : undefined,
    timeline: buildTimeline(forecast),
    actions,
    outflows,
    gapDrivers: buildGapDrivers(invoices, forecast),
    source: options.source,
    orgName: options.orgName,
    demo: options.source === "demo",
    lowDay: forecast.lowDay,
    unpaidReceivables: invoices.filter((i) => i.status === "AUTHORISED").length,
    unpaidPayables: 0,
  };
}

function buildOutflowsFromForecast(
  forecast: ForecastResult,
  _invoices: InvoiceWithExpectedDate[],
): ApiOutflow[] {
  return forecast.curve
    .filter((point) => point.outflow > 0)
    .map((point) => ({
      date: point.date,
      label: dayLabel(point.date),
      amount: Math.round(point.outflow),
      type: "payable",
    }));
}

/** Demo beat: BrightBuild payment lands and the Thursday gap closes on stage. */
export function applyDemoHealOverlay(
  response: ApiForecastResponse,
  paymentAmount: number,
): ApiForecastResponse {
  const gapAmount = response.gap?.amount ?? 0;
  // Pulling the overdue invoice forward lifts every below-buffer day by the
  // payment, so the new worst-day headroom = payment - gap (e.g. 2400 - 1180 = 1220).
  const healedSafeToSpend = Math.max(paymentAmount - gapAmount, 200);

  const timeline = response.timeline.map((day) => {
    if (day.balance < day.buffer) {
      return {
        ...day,
        balance: day.balance + paymentAmount,
        isLowDay: false,
      };
    }
    return { ...day, isLowDay: false };
  });

  return {
    ...response,
    gap: undefined,
    gapClosed: true,
    paymentReceived: paymentAmount,
    safeToSpend: healedSafeToSpend,
    timeline,
    gapDrivers: response.gapDrivers.filter(
      (driver) => !driver.contact.includes("BrightBuild"),
    ),
    actions: response.actions.filter(
      (action) => !action.customer.includes("BrightBuild"),
    ),
  };
}

/** Replay demo: restore the pre-payment gap story even if BrightBuild was paid in Xero. */
export function applyDemoReplayOverlay(
  response: ApiForecastResponse,
): ApiForecastResponse {
  const demo = formatDemoForecastResponse();
  return {
    ...demo,
    source: response.source,
    orgName: response.orgName,
    demo: response.demo,
    gapClosed: undefined,
    paymentReceived: undefined,
  };
}

export async function formatLiveForecastResponse(options?: {
  paymentAmount?: number;
}): Promise<ApiForecastResponse | null> {
  const live = await buildLiveForecast();
  if (!live) return null;

  const { input, forecast } = live;
  const actions = rankActions(input.invoices, forecast, input.today);

  let response = buildResponse(forecast, input.invoices, actions, {
    source: "xero",
    orgName: input.orgName,
    today: input.today,
  });

  response.unpaidPayables = input.bills.length;
  response.outflows = input.bills
    .sort((a, b) => a.payDate.localeCompare(b.payDate))
    .map((bill) => ({
      date: bill.payDate,
      label: `${dayLabel(bill.payDate)} · ${bill.type}`,
      amount: bill.amount,
      type: bill.type,
    }));

  if (isDemoReplayActive()) {
    return applyDemoReplayOverlay(response);
  }

  if (isDemoHealApplied()) {
    return applyDemoHealOverlay(response, getSimulatedPaymentTotal());
  }

  const paymentAmount = options?.paymentAmount;
  const brightBuildOutstanding =
    response.gapDrivers.some((d) => d.contact.includes("BrightBuild")) ||
    response.actions.some((a) => a.customer.includes("BrightBuild"));

  if (paymentAmount && paymentAmount > 0) {
    return applyDemoHealOverlay(response, paymentAmount);
  }

  if (!brightBuildOutstanding && response.gap) {
    const inferred =
      response.gapDrivers.find((d) => d.contact.includes("BrightBuild"))
        ?.amount ?? response.gap.amount;
    return applyDemoHealOverlay(response, inferred);
  }

  if (!response.gap || response.gap.amount <= 0) {
    return {
      ...response,
      gap: undefined,
      gapClosed: true,
      paymentReceived: paymentAmount,
    };
  }

  return response;
}

export function formatDemoForecastResponse(): ApiForecastResponse {
  const forecast = getDemoForecast();
  const actions = rankActions(DEMO_INVOICES, forecast, "2026-07-04");

  const response = buildResponse(forecast, DEMO_INVOICES, actions, {
    source: "demo",
    orgName: "Maya's Catering Co. (demo)",
    today: "2026-07-04",
  });

  response.unpaidPayables = 3;
  response.outflows = [
    { date: "2026-07-07", label: "Tue · supplier", amount: 780, type: "supplier" },
    { date: "2026-07-09", label: "Thu · payroll", amount: 3200, type: "payroll" },
    { date: "2026-07-11", label: "Sat · vat", amount: 420, type: "vat" },
  ];

  if (isDemoHealApplied()) {
    return applyDemoHealOverlay(response, getSimulatedPaymentTotal());
  }

  return response;
}
