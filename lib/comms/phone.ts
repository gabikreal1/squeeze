/** Normalise to E.164 (+country…) for Twilio SMS/Voice/WhatsApp. */
export function normalizePhoneNumber(raw: string): string {
  let value = raw.trim().replace(/[\s()-]/g, "");
  if (value.startsWith("whatsapp:")) value = value.slice(9);
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (!value.startsWith("+")) {
    if (value.startsWith("0")) value = `+44${value.slice(1)}`;
    else value = `+${value}`;
  }
  return value;
}

export function toWhatsAppAddress(phone: string): string {
  return `whatsapp:${normalizePhoneNumber(phone)}`;
}

export function toVoiceAddress(phone: string): string {
  return normalizePhoneNumber(phone);
}
