export type Level = "low" | "medium" | "high";

export type TimelinePoint = {
  date?: string;
  label: string;
  balance: number;
  buffer: number;
  inflow?: number;
  outflow?: number;
  isLowDay?: boolean;
  event?: {
    kind: "payroll" | "vat" | "supplier" | "invoice";
    label: string;
    amount: number;
  };
};

export type LadderStep = {
  rung: number;
  name: string;
  speed: Level;
  cost: Level;
  relationshipRisk: Level;
  recommended?: boolean;
  requiresApproval?: boolean;
  note: string;
};

export type SqueezeAction = {
  id: string;
  customer: string;
  invoiceAmount: number;
  invoiceNumber?: string;
  summary: string;
  recommendation: string;
  speed: Level;
  cost: Level;
  relationshipRisk: Level;
  accent?: "lemon" | "danger" | "neutral";
  actionLabel?: string;
  dontSqueeze?: boolean;
  daysOverdue: number;
  expectedDate: string;
  paymentPattern: string;
  riskClass: "trusted" | "watch" | "at-risk" | "high-risk";
  relationshipValue: "low" | "medium" | "high";
  confidence: number;
  expectedCashDate: string;
  reasoning: string;
  ladder: LadderStep[];
};

export type Outflow = { date: string; label: string; amount: number; type: string };

export type GapDriver = {
  contact: string;
  amount: number;
  expectedDate: string;
  daysOverdue: number;
  invoiceNumber?: string;
  note: string;
};

export type ForecastResponse = {
  safeToSpend: number;
  currentBalance: number;
  buffer: number;
  gap?: { amount: number; dayLabel: string; date?: string };
  timeline: TimelinePoint[];
  actions: SqueezeAction[];
  outflows: Outflow[];
  gapDrivers: GapDriver[];
  source: "xero" | "demo";
  orgName?: string;
  demo: boolean;
  lowDay: string;
  unpaidReceivables: number;
  unpaidPayables: number;
  paymentReceived?: number;
  gapClosed?: boolean;
};

export type Scenario = {
  id: string;
  name: string;
  tag: string;
  safeToSpend: number;
  gapClosed: boolean;
  cost: number;
  relationshipRisk: Level;
  timeToCash: string;
  confidence: number;
  requiresApproval: boolean;
  steps: string[];
  recommended?: boolean;
};

export const scenarios: Scenario[] = [
  {
    id: "a",
    name: "Call BrightBuild today",
    tag: "Plan A",
    safeToSpend: 1220,
    gapClosed: true,
    cost: 0,
    relationshipRisk: "low",
    timeToCash: "Same day",
    confidence: 0.78,
    requiresApproval: true,
    recommended: true,
    steps: [
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
    safeToSpend: 980,
    gapClosed: true,
    cost: 48,
    relationshipRisk: "low",
    timeToCash: "1–2 days",
    confidence: 0.64,
    requiresApproval: false,
    steps: ["Email discount offer", "Auto-adjust invoice on acceptance", "Reconcile in Xero"],
  },
  {
    id: "c",
    name: "Finance Newline invoice",
    tag: "Plan C",
    safeToSpend: 1044,
    gapClosed: true,
    cost: 76,
    relationshipRisk: "low",
    timeToCash: "Same day",
    confidence: 0.88,
    requiresApproval: true,
    steps: ["Advance against invoice", "Fee ~4%", "Repay on settlement"],
  },
  {
    id: "d",
    name: "Delay supplier bill",
    tag: "Plan D",
    safeToSpend: -1120,
    gapClosed: false,
    cost: 0,
    relationshipRisk: "medium",
    timeToCash: "n/a",
    confidence: 0.9,
    requiresApproval: false,
    steps: ["Push payment by 7 days", "Only trims gap slightly"],
  },
  {
    id: "e",
    name: "Do nothing",
    tag: "Plan E",
    safeToSpend: -1180,
    gapClosed: false,
    cost: 0,
    relationshipRisk: "low",
    timeToCash: "n/a",
    confidence: 1,
    requiresApproval: false,
    steps: ["Payroll risk on low day", "Not recommended"],
  },
];

export const guardrails = [
  { title: "B2B invoices only", desc: "Never contacts consumers — business debtors only.", icon: "building" },
  { title: "Your invoices only", desc: "Acts strictly on invoices you raised in Xero.", icon: "file" },
  { title: "AI disclosed on calls", desc: "Every call opens by stating it is an automated assistant.", icon: "phone" },
  { title: "Human approves escalation", desc: "Calls, financing and legal packs wait for your tap.", icon: "shield" },
  { title: "Full audit trail to Xero", desc: "Every action is written back as a note on the invoice.", icon: "history" },
  { title: "Legal is prep, not filing", desc: "Letters Before Action are document packs — never court filings.", icon: "gavel" },
  { title: "Relationship-aware", desc: "Escalation scales with risk and account value.", icon: "heart" },
  { title: "Do-not-squeeze logic", desc: "Reliable late payers are protected from chasing.", icon: "hand" },
];

export const briefing = [
  { role: "Credit Controller", headline: "BrightBuild needs an AI call today.", detail: "£2,400, overdue, two reminders ignored. Driving the gap.", accent: "danger" as const },
  { role: "Treasury", headline: "Pay Henderson early for 2%/10 — an 18% annualised return.", detail: "Spare cash after the gap closes could earn more than it sits idle.", accent: "lemon" as const },
  { role: "Procurement", headline: "Waste supplier prices rose 14%.", detail: "Draft a renegotiation email before the next order.", accent: "neutral" as const },
  { role: "Revenue", headline: "Riverside is high-value but slowing.", detail: "Days-to-pay drifted up. Protect the relationship with a soft touch.", accent: "neutral" as const },
];

export const suggestedPrompts = [
  "Show me the fastest way to close the gap",
  "Protect customer relationships",
  "Compare financing vs calling",
  "Explain the forecast",
  "What changed since yesterday?",
];

export const businessHealth = {
  revenueExpected: 21400,
  receivablesOutstanding: 8180,
  payablesUpcoming: 1980,
  payrollCoverageDays: 6,
  dsoTrend: [38, 41, 39, 44, 47, 46],
  dsoCurrent: 46,
  customerConcentration: [
    { name: "Riverside Hotel", pct: 34 },
    { name: "BrightBuild Ltd", pct: 22 },
    { name: "Newline Events", pct: 18 },
    { name: "Patel Catering", pct: 14 },
    { name: "Others", pct: 12 },
  ],
  lateByValue: [
    { name: "BrightBuild Ltd", amount: 2400 },
    { name: "Riverside Hotel", amount: 3200 },
    { name: "Patel Catering", amount: 680 },
  ],
  pnl: {
    revenue: 21400,
    supplierCosts: 7600,
    payroll: 6100,
    operatingExpenses: 3200,
    get netCashMovement() {
      return this.revenue - this.supplierCosts - this.payroll - this.operatingExpenses;
    },
  },
};
