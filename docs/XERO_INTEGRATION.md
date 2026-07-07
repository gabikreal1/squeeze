# Squeeze — Xero Integration

Squeeze connects to a Xero organisation and uses it as both the data source and the system of record for all collection actions.

## 1. App setup

1. Sign in at [developer.xero.com](https://developer.xero.com/) as an admin of your organisation.
2. Create a **Custom Connection** (server-to-server, client credentials) for development, or a standard **OAuth 2.0 Web App** for production user onboarding.
3. Select the granular scopes listed in section 3.
4. Copy the Client ID and Secret. For Custom Connections, approve the connection from the email Xero sends.

## 2. Access method

Squeeze uses the official **`xero-node`** SDK with direct REST calls to the Accounting API. An optional MCP server configuration is available for agent tooling during development:

```json
{
  "mcpServers": {
    "xero": {
      "command": "npx",
      "args": ["-y", "@xeroapi/xero-mcp-server@latest"],
      "env": {
        "XERO_CLIENT_ID": "…",
        "XERO_CLIENT_SECRET": "…",
        "XERO_SCOPES": "accounting.invoices accounting.payments accounting.contacts accounting.settings"
      }
    }
  }
}
```

> **Scopes note:** Custom connections created after 29 April 2026 must use granular scopes. The broad `accounting.transactions` bundle fails with "Client credentials scope validation failed." Always set `XERO_SCOPES` explicitly.

## 3. OAuth 2.0 scopes

```
accounting.invoices              # read/write invoices (receivables + bills)
accounting.payments              # detect + record payments
accounting.contacts              # customers + payment behaviour
accounting.settings              # org, accounts, tax rates
offline_access                   # refresh token (OAuth mode only)
```

## 4. Endpoints

| Endpoint | Method(s) | Purpose |
|---|---|---|
| `/Invoices` | GET, PUT | Pull receivables (`ACCREC`) and bills (`ACCPAY`) for the forecast |
| `/Invoices/{InvoiceID}` | GET | Fetch a single invoice with its payments |
| `/Payments` | PUT | Record a payment against a receivable |
| `/Payments/{PaymentID}` | GET, POST (Status=DELETED) | Payment lookup; reverse a payment |
| `/Contacts` | GET, PUT, POST | Customer details and payment history |
| `/Accounts` | GET | Bank balances for cash position |
| `/Organisation` | GET | Connection check and org details |
| `/TaxRates` | GET | Tax setup |
| Webhooks | (subscribe) | Real-time Invoice and Payment events |

## 5. Webhooks

- Subscribe to **Invoice** and **Payment** events in the Xero developer portal.
- Point the webhook URL to `PUBLIC_BASE_URL/api/webhooks/xero`.
- Verify the `x-xero-signature` HMAC-SHA256 header against `XERO_WEBHOOK_KEY`.
- Respond with 200 immediately; process events asynchronously.
- On payment, re-run the forecast and push the update to the dashboard via SSE.

For local development, use an HTTPS tunnel (e.g. ngrok) and set `PUBLIC_BASE_URL` to the tunnel URL.

## 6. Seed data

Run `npm run seed` to populate a Xero org with realistic test data. The seed script creates contacts with distinct payment personalities and 6–12 months of backdated invoices and payments so behavioural averages are meaningful.

| Contact | Personality | Role in testing |
|---|---|---|
| Patel Catering | Always pays ~8 days late, reliable | Low risk — soft nudge only |
| BrightBuild Ltd | First-time, £2,400, 17 days overdue | High risk — firm escalation |
| Henderson & Co | Reliable, offers early-pay discount | Treasury opportunity |
| Newline Studio | Medium, slow, large balance | Financing candidate |
| Riverside Hotel | Big recurring client, slightly slow | High-value relationship |

The seed also includes payroll, supplier bills, and VAT set-asides in the next 14 days so a real cash gap appears in the forecast.
