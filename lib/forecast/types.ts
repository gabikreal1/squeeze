export type PaidInvoiceHistory = {
  dueDate: string;
  paidDate: string;
};

export type ContactSegment = "loyal" | "standard" | "first_time" | "strategic";

export type InvoiceWithExpectedDate = {
  invoiceId: string;
  contactId: string;
  contactName: string;
  amount: number;
  dueDate: string;
  expectedDate: string;
  status: "AUTHORISED" | "PAID" | "VOIDED";
  daysOverdue: number;
  contactHistory: PaidInvoiceHistory[];
  segment: ContactSegment;
  viewed?: boolean;
  ignoredReminders?: number;
  hasOpenDispute?: boolean;
  strategicValue?: number;
  trajectorySlowing?: boolean;
};

export type Bill = {
  billId: string;
  description: string;
  amount: number;
  payDate: string;
  type: "payroll" | "vat" | "supplier" | "rent" | "other";
};

export type CashPoint = {
  date: string;
  balance: number;
  inflow: number;
  outflow: number;
  buffer: number;
};

export type ForecastResult = {
  curve: CashPoint[];
  currentBalance: number;
  buffer: number;
  lowPoint: number;
  lowDay: string;
  safeToSpend: number;
  gap: number;
};
