import twilio from "twilio";

export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  whatsappFrom: string;
  voiceFrom?: string;
  contentSid?: string;
};

export function getTwilioConfig(): TwilioConfig {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM?.trim();
  const voiceFrom = process.env.TWILIO_VOICE_FROM?.trim();
  const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID?.trim();

  if (!accountSid || !authToken || !whatsappFrom) {
    throw new Error(
      "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM.",
    );
  }

  return {
    accountSid,
    authToken,
    whatsappFrom: normalizeWhatsAppAddress(whatsappFrom),
    voiceFrom: voiceFrom ? normalizeVoiceAddress(voiceFrom) : undefined,
    contentSid,
  };
}

export function getTwilioClient(): twilio.Twilio {
  const { accountSid, authToken } = getTwilioConfig();
  return twilio(accountSid, authToken);
}

function normalizeWhatsAppAddress(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("whatsapp:")) return trimmed;
  if (trimmed.startsWith("+")) return `whatsapp:${trimmed}`;
  return `whatsapp:+${trimmed}`;
}

function normalizeVoiceAddress(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed;
  return `+${trimmed}`;
}
