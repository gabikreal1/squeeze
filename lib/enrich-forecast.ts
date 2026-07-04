import type { ApiForecastResponse } from "./api/format-forecast";
import type {
  ForecastResponse,
  GapDriver,
  LadderStep,
  Level,
  SqueezeAction,
  TimelinePoint,
} from "./squeeze-data";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatShortDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00.000Z`);
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
}

function outflowKind(type: string): "payroll" | "vat" | "supplier" {
  if (type.includes("payroll")) return "payroll";
  if (type.includes("vat")) return "vat";
  return "supplier";
}

function enrichTimeline(
  timeline: ApiForecastResponse["timeline"],
  outflows: ApiForecastResponse["outflows"],
): TimelinePoint[] {
  const eventsByDate = new Map<string, TimelinePoint["event"]>();

  for (const outflow of outflows) {
    eventsByDate.set(outflow.date, {
      kind: outflowKind(outflow.type),
      label: outflow.label.split(" · ")[0] ?? outflow.type,
      amount: outflow.amount,
    });
  }

  for (const point of timeline) {
    if (point.inflow && point.inflow > 0 && point.date) {
      if (!eventsByDate.has(point.date)) {
        eventsByDate.set(point.date, {
          kind: "invoice",
          label: "Receivable expected",
          amount: point.inflow,
        });
      }
    }
  }

  return timeline.map((point) => ({
    ...point,
    event: point.date ? eventsByDate.get(point.date) : undefined,
  }));
}

function riskClass(action: ApiForecastResponse["actions"][0]): SqueezeAction["riskClass"] {
  if (action.dontSqueeze) return "trusted";
  if (action.accent === "danger") return "high-risk";
  if (action.accent === "lemon") return "watch";
  return "watch";
}

function buildLadder(action: ApiForecastResponse["actions"][0]): LadderStep[] {
  if (action.dontSqueeze) {
    return [
      { rung: 1, name: "Watch", speed: "low", cost: "low", relationshipRisk: "low", recommended: true, note: "Payment is predictable — no action needed." },
      { rung: 2, name: "Soft nudge", speed: "low", cost: "low", relationshipRisk: "medium", note: "Unnecessary for a trusted payer." },
    ];
  }

  if (action.actionLabel === "AI call") {
    return [
      { rung: 1, name: "Watch", speed: "low", cost: "low", relationshipRisk: "low", note: "Reminders already sent." },
      { rung: 2, name: "Soft nudge", speed: "low", cost: "low", relationshipRisk: "low", note: "Unlikely to convert." },
      { rung: 3, name: "Firm reminder", speed: "medium", cost: "low", relationshipRisk: "medium", note: "Still passive." },
      { rung: 4, name: "AI phone call", speed: "high", cost: "low", relationshipRisk: "low", recommended: true, requiresApproval: true, note: "Fastest route to cash today." },
      { rung: 5, name: "Early-pay discount", speed: "medium", cost: "medium", relationshipRisk: "low", note: "Costs margin." },
      { rung: 6, name: "Invoice financing", speed: "high", cost: "high", relationshipRisk: "low", requiresApproval: true, note: "Guaranteed cash but expensive." },
      { rung: 7, name: "Letter Before Action", speed: "low", cost: "medium", relationshipRisk: "high", requiresApproval: true, note: "Evidence pack only." },
    ];
  }

  return [
    { rung: 1, name: "Watch", speed: "low", cost: "low", relationshipRisk: "low", note: "Monitor payment pattern." },
    { rung: 2, name: "Soft nudge", speed: "medium", cost: "low", relationshipRisk: "low", recommended: true, note: action.recommendation },
  ];
}

function enrichAction(
  action: ApiForecastResponse["actions"][0],
  gapDrivers: GapDriver[],
): SqueezeAction {
  const driver = gapDrivers.find((d) => d.contact === action.customer);
  const daysOverdue = driver?.daysOverdue ?? 0;

  return {
    ...action,
    daysOverdue,
    expectedDate: driver ? formatShortDate(driver.expectedDate) : "Soon",
    paymentPattern: action.dontSqueeze
      ? "Reliably late but always pays"
      : action.accent === "danger"
        ? "No history / unresponsive"
        : "Standard payer",
    riskClass: riskClass(action),
    relationshipValue: action.dontSqueeze ? "high" : action.accent === "danger" ? "low" : "medium",
    confidence: action.dontSqueeze ? 0.94 : action.accent === "danger" ? 0.78 : 0.71,
    expectedCashDate: action.dontSqueeze ? formatShortDate(driver?.expectedDate ?? "") : "Today, if action succeeds",
    reasoning: action.recommendation,
    ladder: buildLadder(action),
  };
}

function enrichGapDrivers(
  drivers: ApiForecastResponse["gapDrivers"],
  gap?: ApiForecastResponse["gap"],
): GapDriver[] {
  return drivers.map((driver) => ({
    ...driver,
    note:
      driver.daysOverdue > 14
        ? "Overdue with no reliable payment pattern — main gap driver."
        : driver.daysOverdue > 0
          ? `Expected after ${gap?.dayLabel ?? "the low day"} payroll pressure.`
          : "Due soon but lands after the shortfall.",
  }));
}

function sumReceivables(actions: ApiForecastResponse["actions"]): number {
  return actions.reduce((sum, action) => sum + action.invoiceAmount, 0);
}

export function enrichForecast(api: ApiForecastResponse): ForecastResponse {
  const gapDrivers = enrichGapDrivers(api.gapDrivers, api.gap);
  const timeline = enrichTimeline(api.timeline, api.outflows);

  return {
    safeToSpend: api.safeToSpend,
    currentBalance: api.currentBalance,
    buffer: api.buffer,
    gap: api.gap,
    timeline,
    actions: api.actions.map((action) => enrichAction(action, gapDrivers)),
    outflows: api.outflows,
    gapDrivers,
    source: api.source,
    orgName: api.orgName,
    demo: api.demo,
    lowDay: api.gap?.dayLabel ?? formatShortDate(api.lowDay),
    unpaidReceivables: sumReceivables(api.actions) || api.unpaidReceivables * 900,
    unpaidPayables: api.outflows.reduce((sum, o) => sum + o.amount, 0) || api.unpaidPayables * 680,
    paymentReceived: api.paymentReceived,
    gapClosed: api.gapClosed,
  };
}
