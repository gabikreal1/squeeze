import type { InvoiceWithExpectedDate } from "../forecast/types";

export type ActionRung =
  | "watch"
  | "nudge"
  | "firm_reminder"
  | "ai_call"
  | "discount"
  | "financing"
  | "lba";

export type ActionCandidate = {
  rung: ActionRung;
  label: string;
  speed: number;
  speedOk: boolean;
  cost: number;
  relRisk: number;
};

export type Recommendation = {
  invoiceId: string;
  contactName: string;
  amount: number;
  rung: ActionRung;
  speed: number;
  cost: number;
  relRisk: number;
  customerRiskScore: number;
  dontSqueeze: boolean;
  reasoning: string;
  invoice: InvoiceWithExpectedDate;
};
