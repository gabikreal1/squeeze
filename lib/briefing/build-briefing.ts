import type { ApiForecastResponse } from "../api/format-forecast";
import { gbp } from "../format";
import {
  briefing as staticBriefing,
  businessHealth as staticHealth,
  type ForecastResponse,
} from "../squeeze-data";

export type BriefingCard = (typeof staticBriefing)[number];
export type BusinessHealthSnapshot = typeof staticHealth;

function orgShortName(orgName: string): string {
  return orgName.replace(/\s*\(demo\)\s*$/i, "").trim() || orgName;
}

function brightBuildPayment(forecast: ForecastResponse | ApiForecastResponse): number {
  return (
    forecast.paymentReceived ??
    forecast.actions.find((a) => a.customer.includes("BrightBuild"))?.invoiceAmount ??
    2400
  );
}

/** Role cards for the Monday briefing — reflect gap closed after payment. */
export function buildBriefingFromForecast(
  forecast: ForecastResponse | ApiForecastResponse,
  healed: boolean,
): {
  title: string;
  intro: string;
  cards: BriefingCard[];
} {
  const org = orgShortName(forecast.orgName ?? "your business");

  if (!healed) {
    const gapAmount = forecast.gap?.amount;
    const credit = staticBriefing.find((b) => b.role === "Credit Controller");
    return {
      title: `Squeeze is becoming a whole finance department for ${org}.`,
      intro: "Four roles, one operator. Here's what each function flagged this week.",
      cards: staticBriefing.map((card) =>
        card.role === "Credit Controller" && gapAmount && credit
          ? {
              ...card,
              detail: `${credit.detail.split(".")[0]}. Gap ${gbp(gapAmount)} by ${forecast.gap?.dayLabel ?? "payroll day"}.`,
            }
          : card,
      ),
    };
  }

  const payment = brightBuildPayment(forecast);

  return {
    title: `${org} — cash position restored.`,
    intro: "Gap closed this morning. Here's where each function is focused now.",
    cards: [
      {
        role: "Credit Controller",
        headline: "Gap closed — BrightBuild paid.",
        detail: `${gbp(payment)} landed in Xero. Safe-to-spend is ${gbp(forecast.safeToSpend)} above your buffer.`,
        accent: "lemon",
      },
      {
        role: "Treasury",
        headline: "Pay Henderson early for 2%/10 — an 18% annualised return.",
        detail: "With the gap closed, spare cash can earn more than sitting idle. Ready to draft the payment.",
        accent: "lemon",
      },
      {
        role: "Procurement",
        headline: "Waste supplier prices rose 14%.",
        detail: "Cash headroom restored — good time to renegotiate before the next order.",
        accent: "neutral",
      },
      {
        role: "Revenue",
        headline: "Riverside is high-value but slowing.",
        detail: "Days-to-pay drifted up. Protect the relationship with a soft touch.",
        accent: "neutral",
      },
    ],
  };
}

/** KPI strip and charts — drop collected invoices when healed. */
export function buildHealthFromForecast(
  forecast: ForecastResponse | ApiForecastResponse,
  healed: boolean,
): BusinessHealthSnapshot {
  if (!healed) return staticHealth;

  const payment = brightBuildPayment(forecast);
  const receivables = Math.max(0, staticHealth.receivablesOutstanding - payment);
  const lateByValue = staticHealth.lateByValue.filter(
    (row) => !row.name.includes("BrightBuild"),
  );
  const payrollCoverageDays = Math.max(
    staticHealth.payrollCoverageDays,
    Math.round(Math.max(forecast.safeToSpend, 0) / 680) || 14,
  );
  const dsoCurrent = Math.max(38, staticHealth.dsoCurrent - 3);
  const dsoTrend = [...staticHealth.dsoTrend.slice(0, -1), dsoCurrent];

  return {
    ...staticHealth,
    receivablesOutstanding: receivables,
    lateByValue,
    payrollCoverageDays,
    dsoCurrent,
    dsoTrend,
  };
}
