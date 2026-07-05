import type { CallContext } from "./conversation-relay";

/** Pass call context on the Twilio voice webhook URL (avoids race before DB session is written). */
export function encodeCallContextQuery(context: CallContext): string {
  return new URLSearchParams({
    cn: context.contactName,
    amt: String(context.invoiceAmount),
    od: String(context.daysOverdue),
    inv: context.invoiceNumber ?? "",
  }).toString();
}

export function parseCallContextFromSearchParams(
  params: URLSearchParams,
): CallContext | null {
  const contactName = params.get("cn")?.trim();
  if (!contactName) return null;

  return {
    contactName,
    invoiceAmount: Number(params.get("amt")) || 0,
    daysOverdue: Number(params.get("od")) || 0,
    invoiceNumber: params.get("inv")?.trim() || undefined,
  };
}
