import type { Contact } from "xero-node";
import { Phone } from "xero-node";
import { normalizePhoneNumber } from "../comms/phone";
import { getContacts, isXeroConnected } from "./client";

export function pickContactPhone(contact: Contact): string | undefined {
  const phones = contact.phones ?? [];
  const mobile = phones.find((p) => p.phoneType === Phone.PhoneTypeEnum.MOBILE);
  const defaultPhone = phones.find((p) => p.phoneType === Phone.PhoneTypeEnum.DEFAULT);
  const fallback = phones[0];
  const raw =
    mobile?.phoneNumber ?? defaultPhone?.phoneNumber ?? fallback?.phoneNumber;
  if (!raw?.trim()) return undefined;
  return normalizePhoneNumber(raw);
}

export function buildContactPhoneMaps(contacts: Contact[]): {
  byId: Map<string, string>;
  byName: Map<string, string>;
} {
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const contact of contacts) {
    const phone = pickContactPhone(contact);
    if (!phone) continue;
    if (contact.contactID) byId.set(contact.contactID, phone);
    if (contact.name) byName.set(contact.name, phone);
  }
  return { byId, byName };
}

export async function resolveContactPhone(input: {
  contactId?: string;
  contactName?: string;
}): Promise<string | null> {
  if (!isXeroConnected()) return null;

  const contacts = await getContacts();
  const { byId, byName } = buildContactPhoneMaps(contacts);

  if (input.contactId && byId.has(input.contactId)) {
    return byId.get(input.contactId) ?? null;
  }
  if (input.contactName && byName.has(input.contactName)) {
    return byName.get(input.contactName) ?? null;
  }
  return null;
}
