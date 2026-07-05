import type { ApiForecastResponse } from "../api/format-forecast";

export const COPILOT_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "get_forecast",
      description:
        "Safe-to-spend, bank balance, safety buffer, cash gap summary, and whether the gap is closed.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_gap_drivers",
      description: "Unpaid invoices driving the cash shortfall, ranked by amount.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_recommended_actions",
      description:
        "Per-customer collection recommendations with speed, cost, relationship risk, and dontSqueeze flags.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_cash_timeline",
      description: "14-day projected cash curve with daily balances and buffer line.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_upcoming_outflows",
      description: "Payroll, VAT, and supplier bills due in the next 14 days.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compare_collection_plans",
      description:
        "Compare fastest collection options (e.g. AI call vs financing) by speed, cost, and confidence.",
      parameters: {
        type: "object",
        properties: {
          focusCustomer: {
            type: "string",
            description: "Optional customer name to focus comparison on.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_customer_detail",
      description: "Deep dive on one customer's invoice, risk, and recommended action.",
      parameters: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer or contact name." },
        },
        required: ["customer"],
        additionalProperties: false,
      },
    },
  },
];

function gbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function executeCopilotTool(
  name: string,
  args: Record<string, unknown>,
  forecast: ApiForecastResponse,
): unknown {
  switch (name) {
    case "get_forecast":
      return {
        orgName: forecast.orgName,
        source: forecast.source,
        safeToSpend: forecast.safeToSpend,
        safeToSpendFormatted: gbp(forecast.safeToSpend),
        currentBalance: forecast.currentBalance,
        buffer: forecast.buffer,
        gap: forecast.gap,
        gapClosed: forecast.gapClosed ?? false,
        paymentReceived: forecast.paymentReceived,
        lowDay: forecast.lowDay,
      };
    case "get_gap_drivers":
      return forecast.gapDrivers;
    case "get_recommended_actions":
      return forecast.actions.map((a) => ({
        customer: a.customer,
        invoiceAmount: a.invoiceAmount,
        invoiceNumber: a.invoiceNumber,
        summary: a.summary,
        recommendation: a.recommendation,
        speed: a.speed,
        cost: a.cost,
        relationshipRisk: a.relationshipRisk,
        dontSqueeze: a.dontSqueeze,
        actionLabel: a.actionLabel,
      }));
    case "get_cash_timeline":
      return forecast.timeline.map((t) => ({
        date: t.date,
        label: t.label,
        balance: t.balance,
        buffer: t.buffer,
        isLowDay: t.isLowDay,
        inflow: t.inflow,
        outflow: t.outflow,
      }));
    case "get_upcoming_outflows":
      return forecast.outflows;
    case "compare_collection_plans": {
      const focus = String(args.focusCustomer ?? "").toLowerCase();
      const candidates = forecast.actions.filter((a) => {
        if (!focus) return a.actionLabel === "AI call" || a.accent === "danger";
        return a.customer.toLowerCase().includes(focus);
      });
      return candidates.map((a) => ({
        customer: a.customer,
        amount: a.invoiceAmount,
        recommended: a.recommendation,
        speed: a.speed,
        cost: a.cost,
        relationshipRisk: a.relationshipRisk,
        actionLabel: a.actionLabel,
      }));
    }
    case "get_customer_detail": {
      const needle = String(args.customer ?? "").toLowerCase();
      const action = forecast.actions.find((a) =>
        a.customer.toLowerCase().includes(needle),
      );
      const driver = forecast.gapDrivers.find((d) =>
        d.contact.toLowerCase().includes(needle),
      );
      if (!action && !driver) {
        return { error: `No customer matching "${args.customer}" in forecast.` };
      }
      return { action, driver };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export function toolLabel(name: string, args?: Record<string, unknown>): string {
  if (name === "get_customer_detail" && args?.customer) {
    return `get_customer(${args.customer})`;
  }
  if (name === "compare_collection_plans" && args?.focusCustomer) {
    return `compare_plans(${args.focusCustomer})`;
  }
  const labels: Record<string, string> = {
    get_forecast: "read_bank_balance",
    get_gap_drivers: "rank_gap",
    get_recommended_actions: "recommend",
    get_cash_timeline: "project_cashflow(14d)",
    get_upcoming_outflows: "list_outflows(14d)",
    compare_collection_plans: "compare(planA, planC)",
  };
  return labels[name] ?? name;
}
