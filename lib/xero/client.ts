import { Invoice, XeroClient } from "xero-node";
import { getOAuthXeroClient } from "./oauth";
import { loadXeroTenantId, loadXeroTokenSet, saveXeroTokenSet } from "./token-store";

const DEFAULT_SCOPES = [
  "accounting.invoices",
  "accounting.payments",
  "accounting.contacts",
  "accounting.settings",
  "offline_access",
].join(" ");

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Set it in your environment or .env file.`,
    );
  }
  return value;
}

function getScopes(): string[] {
  const raw = process.env.XERO_SCOPES?.trim() || DEFAULT_SCOPES;
  return raw.split(/\s+/).filter(Boolean);
}

export function useCustomConnection(): boolean {
  return process.env.XERO_AUTH_MODE?.trim() === "custom_connection";
}

export function isXeroConnected(): boolean {
  if (useCustomConnection()) {
    return Boolean(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);
  }
  return loadXeroTokenSet() !== null && Boolean(getTenantIdOrNull());
}

function getTenantIdOrNull(): string | null {
  return process.env.XERO_TENANT_ID?.trim() || loadXeroTenantId() || null;
}

export function getTenantId(): string {
  const tenantId = getTenantIdOrNull();
  if (tenantId) return tenantId;

  if (useCustomConnection()) {
    return "";
  }

  throw new Error(
    "Not connected to Xero. Open http://localhost:3000/api/xero/connect and select Demo Company.",
  );
}

/** Alias for getTenantId — returns the configured Xero organisation tenant id. */
export const withTenantId = getTenantId;

let customClient: XeroClient | null = null;
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function getCustomConnectionClient(): XeroClient {
  if (customClient) return customClient;

  customClient = new XeroClient({
    clientId: requireEnv("XERO_CLIENT_ID"),
    clientSecret: requireEnv("XERO_CLIENT_SECRET"),
    grantType: "client_credentials",
    scopes: getScopes(),
  });

  return customClient;
}

async function ensureCustomConnectionAuth(): Promise<XeroClient> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return getCustomConnectionClient();
  }

  const xero = getCustomConnectionClient();
  const tokenSet = await xero.getClientCredentialsToken();

  if (!tokenSet.access_token) {
    throw new Error(
      "Failed to obtain Xero access token. Check Custom Connection authorization in developer.xero.com.",
    );
  }

  const expiresInMs = (tokenSet.expires_in ?? 1800) * 1000;
  cachedAccessToken = {
    token: tokenSet.access_token,
    expiresAt: Date.now() + expiresInMs - 60_000,
  };

  await xero.setTokenSet(tokenSet);
  return xero;
}

async function ensureOAuthAuth(): Promise<XeroClient> {
  const stored = loadXeroTokenSet();
  if (!stored) {
    throw new Error(
      "Not connected to Xero. Open http://localhost:3000/api/xero/connect and select Demo Company.",
    );
  }

  const xero = getOAuthXeroClient();
  await xero.initialize();
  await xero.setTokenSet(stored);
  const tokenSet = await xero.readTokenSet();

  if (tokenSet.expired()) {
    if (!tokenSet.refresh_token) {
      throw new Error(
        "Xero session expired. Reconnect at http://localhost:3000/api/xero/connect",
      );
    }
    try {
      const refreshed = await xero.refreshToken();
      saveXeroTokenSet(refreshed);
      await xero.setTokenSet(refreshed);
    } catch {
      const clientId = process.env.XERO_CLIENT_ID?.trim();
      const clientSecret = process.env.XERO_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) throw new Error("Xero credentials missing.");
      const refreshed = await xero.refreshWithRefreshToken(
        clientId,
        clientSecret,
        tokenSet.refresh_token,
      );
      saveXeroTokenSet(refreshed);
      await xero.setTokenSet(refreshed);
    }
  }

  return xero;
}

export async function ensureAuthenticated(): Promise<XeroClient> {
  if (useCustomConnection()) {
    return ensureCustomConnectionAuth();
  }
  return ensureOAuthAuth();
}

export async function getAccessToken(): Promise<string> {
  const xero = await ensureAuthenticated();
  const tokenSet = await xero.readTokenSet();
  if (!tokenSet.access_token) {
    throw new Error("No Xero access token available.");
  }
  return tokenSet.access_token;
}

export async function getOrganisations() {
  const xero = await ensureAuthenticated();
  const tenantId = getTenantId();

  const response = await xero.accountingApi.getOrganisations(tenantId);
  return response.body.organisations ?? [];
}

export async function getInvoices(): Promise<Invoice[]> {
  const xero = await ensureAuthenticated();
  const tenantId = getTenantId();

  const response = await xero.accountingApi.getInvoices(
    tenantId,
    undefined,
    'Type=="ACCREC"',
  );

  return response.body.invoices ?? [];
}

export async function getBills(): Promise<Invoice[]> {
  const xero = await ensureAuthenticated();
  const tenantId = getTenantId();

  const response = await xero.accountingApi.getInvoices(
    tenantId,
    undefined,
    'Type=="ACCPAY"',
  );

  return response.body.invoices ?? [];
}

export async function getContacts() {
  const xero = await ensureAuthenticated();
  const tenantId = getTenantId();

  const response = await xero.accountingApi.getContacts(tenantId);
  return response.body.contacts ?? [];
}

export async function getBankBalance(): Promise<number> {
  const xero = await ensureAuthenticated();
  const tenantId = getTenantId();

  const response = await xero.accountingApi.getAccounts(tenantId);
  const accounts = response.body.accounts ?? [];

  const bankTotal = accounts
    .filter((account) => account.type?.toString() === "BANK")
    .reduce(
      (sum, account) =>
        sum + Number((account as { balance?: number }).balance ?? 0),
      0,
    );

  return bankTotal;
}
