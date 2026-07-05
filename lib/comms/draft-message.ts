import type { ActionRung } from "../decision/types";

export type MessageDraftInput = {
  customer: string;
  invoiceNumber?: string;
  amount: number;
  daysOverdue: number;
  rung: ActionRung;
  orgName?: string;
  dontSqueeze?: boolean;
};

function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function draftChaseMessage(input: MessageDraftInput): string {
  const ref = input.invoiceNumber ? ` (${input.invoiceNumber})` : "";
  const amount = formatGbp(input.amount);
  const business = input.orgName ?? "Maya's Catering Co.";

  if (input.dontSqueeze || input.rung === "nudge") {
    return `Hi ${input.customer} team — friendly reminder from ${business}: invoice${ref} for ${amount} is outstanding. Could you confirm when we can expect payment? Thank you.`;
  }

  if (input.rung === "firm_reminder") {
    return `Hi ${input.customer} team — this is ${business}. Invoice${ref} for ${amount} is now ${input.daysOverdue} days overdue and we haven't had a response to earlier reminders. Please confirm a payment date this week.`;
  }

  return `Hi ${input.customer} team — ${business} is following up on invoice${ref} for ${amount}. Please reply with your expected payment date.`;
}

/** Maps to Twilio content template variables {{1}} and {{2}}. */
export function contentVariablesForTemplate(input: MessageDraftInput): Record<string, string> {
  const ref = input.invoiceNumber ?? "your invoice";
  return {
    "1": `${formatGbp(input.amount)} · ${ref}`,
    "2":
      input.daysOverdue > 0
        ? `${input.daysOverdue} days overdue — please confirm payment date`
        : "payment due — please confirm date",
  };
}
