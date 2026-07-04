import "dotenv/config";
import { runMigrations } from "../lib/db/client";
import { buildConsentUrl, exchangeAuthCode } from "../lib/xero/oauth";

async function main() {
  runMigrations();

  const codeArg = process.argv[2];

  if (!codeArg) {
    const url = await buildConsentUrl();
    console.log("\n1. Open this URL in your browser and approve access:\n");
    console.log(url);
    console.log(
      "\n2. After redirect, copy the FULL callback URL (or just the ?code= value).",
    );
    console.log(
      "   Redirect URI in .env:",
      process.env.XERO_REDIRECT_URI ?? "(not set)",
    );
    console.log(
      "\n3. Run: npm run xero:auth -- \"<full callback url or code>\"\n",
    );
    return;
  }

  let callbackUrl = codeArg.trim();
  if (!callbackUrl.startsWith("http")) {
    const redirect =
      process.env.XERO_REDIRECT_URI ?? "http://localhost:3000/api/xero/callback";
    callbackUrl = `${redirect}?code=${encodeURIComponent(callbackUrl)}`;
  }

  const { tenantId, tenantName } = await exchangeAuthCode(callbackUrl);
  console.log(`\n✓ Connected to ${tenantName}`);
  console.log(`\nAdd to .env:\nXERO_TENANT_ID=${tenantId}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
