import "dotenv/config";
import { runMigrations } from "../lib/db/client";
import { getOrganisations, getInvoices, isXeroConnected, useCustomConnection } from "../lib/xero/client";

async function main() {
  runMigrations();

  if (!useCustomConnection() && !isXeroConnected()) {
    console.log("OAuth mode — not connected yet.\n");
    console.log("1. npm run dev");
    console.log("2. Open http://localhost:3000/api/xero/connect");
    console.log("3. Log in and select Demo Company");
    console.log("4. Re-run: npm run xero:smoke\n");
    process.exit(1);
  }

  console.log(
    useCustomConnection()
      ? "Checking Custom Connection…"
      : "Checking OAuth connection…",
  );

  try {
    const orgs = await getOrganisations();
    const name = orgs[0]?.name ?? "unknown";
    console.log(`✓ Connected to organisation: ${name}`);

    const invoices = await getInvoices();
    console.log(`✓ ACCREC invoices: ${invoices.length}`);
  } catch (error) {
    let status: number | undefined;
    if (typeof error === "string") {
      try {
        status = JSON.parse(error).response?.statusCode;
      } catch {
        /* ignore */
      }
    } else if (typeof error === "object" && error !== null && "response" in error) {
      status = (error as { response?: { statusCode?: number } }).response?.statusCode;
    }

    console.error(`✗ ${(error as Error).message ?? "API call failed"}`);
    if (status === 403) {
      console.log("\n403 = Custom Connection not authorized. Use OAuth instead:");
      console.log("  http://localhost:3000/api/xero/connect\n");
    }
    process.exit(1);
  }
}

main();
