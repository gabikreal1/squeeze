import type { ApiForecastResponse } from "../api/format-forecast";
import type { ForecastResponse, Level, Scenario } from "../squeeze-data";

function findBrightBuildAmount(forecast: {
  actions: { customer: string; invoiceAmount: number }[];
  gapDrivers: { contact: string; amount: number }[];
  gap?: { amount: number };
}): number {
  const action = forecast.actions.find((a) =>
    a.customer.toLowerCase().includes("brightbuild"),
  );
  if (action) return action.invoiceAmount;
  const driver = forecast.gapDrivers.find((d) =>
    d.contact.toLowerCase().includes("brightbuild"),
  );
  if (driver) return driver.amount;
  return forecast.gap?.amount ?? 2400;
}

function brightBuildStillOutstanding(forecast: {
  actions: { customer: string }[];
  gapDrivers: { contact: string }[];
}): boolean {
  return (
    forecast.actions.some((a) => a.customer.toLowerCase().includes("brightbuild")) ||
    forecast.gapDrivers.some((d) => d.contact.toLowerCase().includes("brightbuild"))
  );
}

/** Derive what-if plans from the current forecast — updates when payment lands. */
export function buildScenariosFromForecast(
  forecast: ForecastResponse | ApiForecastResponse,
): Scenario[] {
  const healed = Boolean(forecast.gapClosed);
  const baseline = forecast.safeToSpend;
  const gapAmount = forecast.gap?.amount ?? Math.max(0, -baseline);
  const bbAmount = findBrightBuildAmount(forecast);
  const bbOutstanding = brightBuildStillOutstanding(forecast);

  const callSafe = healed ? baseline : baseline + bbAmount;
  const discountSafe = healed ? baseline : baseline + bbAmount - Math.round(bbAmount * 0.02);
  const financeSafe = healed ? baseline : baseline + Math.round(bbAmount * 0.85);
  const delaySafe = healed ? baseline : baseline + Math.min(680, gapAmount * 0.3);
  const nothingSafe = baseline;

  const recommended = healed ? false : bbOutstanding;

  return [
    {
      id: "a",
      name: "Call BrightBuild today",
      tag: "Plan A",
      safeToSpend: Math.round(callSafe),
      gapClosed: healed || callSafe >= 0,
      cost: 0,
      relationshipRisk: "low",
      timeToCash: healed ? "Done" : "Same day",
      confidence: healed ? 1 : 0.78,
      requiresApproval: !healed,
      recommended,
      steps: healed
        ? [
            "BrightBuild payment received",
            "Outcome logged to Xero",
            "Safe-to-spend restored",
            "Gap closed for this cycle",
          ]
        : [
            "Disclosed AI call to BrightBuild AP",
            "Confirm payment reference",
            "Log outcome to Xero",
            "Notify owner on payment",
          ],
    },
    {
      id: "b",
      name: "Offer 2% early-pay discount",
      tag: "Plan B",
      safeToSpend: Math.round(discountSafe),
      gapClosed: healed || discountSafe >= 0,
      cost: healed ? 0 : Math.round(bbAmount * 0.02),
      relationshipRisk: "low",
      timeToCash: healed ? "Done" : "1–2 days",
      confidence: healed ? 1 : 0.64,
      requiresApproval: false,
      steps: healed
        ? ["Discount no longer needed — invoice settled"]
        : ["Email discount offer", "Auto-adjust invoice on acceptance", "Reconcile in Xero"],
    },
    {
      id: "c",
      name: "Finance Newline invoice",
      tag: "Plan C",
      safeToSpend: Math.round(financeSafe),
      gapClosed: healed || financeSafe >= 0,
      cost: healed ? 0 : 76,
      relationshipRisk: "low",
      timeToCash: healed ? "Done" : "Same day",
      confidence: healed ? 1 : 0.88,
      requiresApproval: !healed,
      steps: healed
        ? ["Financing not required — gap closed"]
        : ["Advance against invoice", "Fee ~4%", "Repay on settlement"],
    },
    {
      id: "d",
      name: "Delay supplier bill",
      tag: "Plan D",
      safeToSpend: Math.round(delaySafe),
      gapClosed: healed || delaySafe >= 0,
      cost: 0,
      relationshipRisk: "medium" as Level,
      timeToCash: "n/a",
      confidence: 0.9,
      requiresApproval: false,
      steps: healed
        ? ["Supplier timing no longer critical"]
        : ["Push payment by 7 days", "Only trims gap slightly"],
    },
    {
      id: "e",
      name: healed ? "Gap closed" : "Do nothing",
      tag: "Plan E",
      safeToSpend: Math.round(nothingSafe),
      gapClosed: healed,
      cost: 0,
      relationshipRisk: "low",
      timeToCash: "n/a",
      confidence: 1,
      requiresApproval: false,
      steps: healed
        ? ["Cash position restored", "Monitor next 14 days"]
        : ["Payroll risk on low day", "Not recommended"],
    },
  ];
}

export function pickDefaultScenarioId(
  scenarios: Scenario[],
  healed: boolean,
): string {
  if (healed) return "a";
  return scenarios.find((s) => s.recommended)?.id ?? "a";
}
