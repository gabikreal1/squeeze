import "dotenv/config";
import { DEMO_CONTACT_PHONE } from "../lib/forecast/engine";
import { sendWhatsAppMessage } from "../lib/comms/whatsapp";
import { resolveContactPhone } from "../lib/xero/contact-phone";

async function main(): Promise<void> {
  const customer = process.argv[2] ?? "Patel Catering";
  const invoiceNumber = process.argv[3] ?? "SQZ-PAT-900";
  const amount = Number(process.argv[4] ?? 680);
  const daysOverdue = Number(process.argv[5] ?? 6);

  const to =
    process.argv[6] ??
    (await resolveContactPhone({ contactName: customer })) ??
    DEMO_CONTACT_PHONE;

  const result = await sendWhatsAppMessage({
    customer,
    invoiceNumber,
    amount,
    daysOverdue,
    rung: "nudge",
    dontSqueeze: true,
    to,
  });

  console.log("WhatsApp sent:", result.sid);
  console.log("To:", result.to, `(from Xero contact: ${to})`);
  console.log("Preview:", result.body);
  console.log("Template:", result.usedTemplate ? "yes" : "body text");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
