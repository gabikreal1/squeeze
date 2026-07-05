import {
  Account,
  AccountType,
  CurrencyCode,
  type Invoice,
  type Payment,
  type PaymentDelete,
} from "xero-node";
import { ensureAuthenticated, getInvoices, getTenantId } from "./client";

function isBankAccount(account: Account): boolean {
  return String(account.type) === "BANK";
}

function isActiveAccount(account: Account): boolean {
  return String(account.status ?? "ACTIVE") === "ACTIVE";
}

async function listAccounts(): Promise<Account[]> {
  const xero = await ensureAuthenticated();
  const tenantId = getTenantId();
  const response = await xero.accountingApi.getAccounts(tenantId);
  return response.body.accounts ?? [];
}

async function createDemoBankAccount(): Promise<Account> {
  const xero = await ensureAuthenticated();
  const tenantId = getTenantId();

  const created = await xero.accountingApi.createAccount(tenantId, {
    code: "090",
    name: "Business Bank Account",
    type: AccountType.BANK,
    bankAccountNumber: "12345678",
    bankAccountType: Account.BankAccountTypeEnum.BANK,
    currencyCode: CurrencyCode.GBP,
  });

  const account = created.body.accounts?.[0];
  if (!account?.accountID) {
    throw new Error("Failed to create a bank account in Xero.");
  }

  console.log("[xero] created demo bank account:", account.name, account.code);
  return account;
}

/** Ensures a BANK account exists — creates one for demo orgs that ship without bank accounts. */
export async function ensureBankAccount(): Promise<Account> {
  const accounts = await listAccounts();
  const bank =
    accounts.find((account) => isBankAccount(account) && isActiveAccount(account)) ??
    accounts.find(isBankAccount);

  if (bank?.accountID) {
    return bank;
  }

  return createDemoBankAccount();
}

export async function findReceivableByNumber(
  invoiceNumber: string,
): Promise<Invoice | undefined> {
  const invoices = await getInvoices();
  return invoices.find(
    (invoice) =>
      invoice.invoiceNumber === invoiceNumber &&
      invoice.status?.toString() === "AUTHORISED",
  );
}

/**
 * Deletes any payments on a receivable so it returns to AUTHORISED — used by
 * "Replay demo" so the pay → heal → reset cycle is repeatable against a real
 * Xero org. Returns the number of payments reversed (0 if nothing to undo).
 */
export async function reverseInvoicePayment(
  invoiceNumber: string,
): Promise<number> {
  const invoices = await getInvoices();
  const match = invoices.find(
    (invoice) => invoice.invoiceNumber === invoiceNumber,
  );
  if (!match?.invoiceID) {
    return 0;
  }

  const xero = await ensureAuthenticated();
  const tenantId = getTenantId();

  const full = await xero.accountingApi.getInvoice(tenantId, match.invoiceID);
  const payments = full.body.invoices?.[0]?.payments ?? [];

  let reversed = 0;
  for (const payment of payments) {
    if (!payment.paymentID) continue;
    const paymentDelete: PaymentDelete = { status: "DELETED" };
    await xero.accountingApi.deletePayment(tenantId, payment.paymentID, paymentDelete);
    reversed += 1;
  }
  return reversed;
}

export async function getPaymentById(paymentId: string): Promise<Payment | undefined> {
  const xero = await ensureAuthenticated();
  const tenantId = getTenantId();
  const response = await xero.accountingApi.getPayment(tenantId, paymentId);
  return response.body.payments?.[0];
}

export async function recordInvoicePayment(input: {
  invoiceNumber: string;
  amount?: number;
}): Promise<{ paymentId: string; amount: number; invoiceNumber: string }> {
  const invoice = await findReceivableByNumber(input.invoiceNumber);
  if (!invoice?.invoiceID) {
    throw new Error(`Invoice ${input.invoiceNumber} not found or already paid.`);
  }

  const amount = input.amount ?? invoice.amountDue ?? invoice.total ?? 0;
  if (amount <= 0) {
    throw new Error(`Invoice ${input.invoiceNumber} has nothing due.`);
  }

  const bank = await ensureBankAccount();
  const xero = await ensureAuthenticated();
  const tenantId = getTenantId();
  const today = new Date().toISOString().slice(0, 10);

  const created = await xero.accountingApi.createPayment(tenantId, {
    invoice: { invoiceID: invoice.invoiceID },
    account: { accountID: bank.accountID },
    amount,
    date: today,
  });

  const payment = created.body.payments?.[0];
  if (!payment?.paymentID) {
    throw new Error("Xero did not return a payment ID.");
  }

  return {
    paymentId: payment.paymentID,
    amount,
    invoiceNumber: input.invoiceNumber,
  };
}
