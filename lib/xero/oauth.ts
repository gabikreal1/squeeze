import { XeroClient } from "xero-node";
import { loadXeroTokenSet, saveXeroTokenSet, saveXeroTenantId } from "./token-store";

function getScopes(): string[] {
  const raw =
    process.env.XERO_SCOPES?.trim() ??
    "accounting.invoices accounting.payments accounting.contacts accounting.settings offline_access";
  return raw.split(/\s+/).filter(Boolean);
}

export function getOAuthXeroClient(): XeroClient {
  const clientId = process.env.XERO_CLIENT_ID?.trim();
  const clientSecret = process.env.XERO_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.XERO_REDIRECT_URI?.trim() ?? "http://localhost:3000/api/xero/callback";

  if (!clientId || !clientSecret) {
    throw new Error("XERO_CLIENT_ID and XERO_CLIENT_SECRET are required.");
  }

  return new XeroClient({
    clientId,
    clientSecret,
    redirectUris: [redirectUri],
    scopes: getScopes(),
  });
}

export async function buildConsentUrl(): Promise<string> {
  const xero = getOAuthXeroClient();
  await xero.initialize();
  return xero.buildConsentUrl();
}

/** Exchange authorization code from redirect callback. */
export async function exchangeAuthCode(callbackUrl: string): Promise<{
  tenantId: string;
  tenantName: string;
}> {
  const xero = getOAuthXeroClient();
  await xero.initialize();
  const tokenSet = await xero.apiCallback(callbackUrl);
  await xero.setTokenSet(tokenSet);
  saveXeroTokenSet(tokenSet);

  await xero.updateTenants(false);
  const tenant = xero.tenants[0];
  if (!tenant) {
    throw new Error("No Xero tenant after OAuth — approve org access in consent screen.");
  }

  saveXeroTenantId(tenant.tenantId);
  return { tenantId: tenant.tenantId, tenantName: tenant.tenantName ?? "Unknown" };
}

export async function getOAuthAccessToken(): Promise<string | null> {
  const stored = loadXeroTokenSet();
  if (!stored) return null;

  const xero = getOAuthXeroClient();
  await xero.initialize();
  await xero.setTokenSet(stored);
  const tokenSet = await xero.readTokenSet();

  if (tokenSet.expired()) {
    if (!tokenSet.refresh_token) return null;
    try {
      const refreshed = await xero.refreshToken();
      saveXeroTokenSet(refreshed);
      return refreshed.access_token ?? null;
    } catch {
      const clientId = process.env.XERO_CLIENT_ID?.trim();
      const clientSecret = process.env.XERO_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) return null;
      const refreshed = await xero.refreshWithRefreshToken(
        clientId,
        clientSecret,
        tokenSet.refresh_token,
      );
      saveXeroTokenSet(refreshed);
      return refreshed.access_token ?? null;
    }
  }

  return tokenSet.access_token ?? null;
}
