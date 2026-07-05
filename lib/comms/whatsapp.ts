import {
  contentVariablesForTemplate,
  draftChaseMessage,
  type MessageDraftInput,
} from "./draft-message";
import { logOutboundMessage } from "./log-action";
import { toWhatsAppAddress } from "./phone";
import { getTwilioClient, getTwilioConfig } from "./twilio-client";

export type SendWhatsAppInput = MessageDraftInput & {
  to: string;
};

export type SendWhatsAppResult = {
  sid: string;
  to: string;
  body: string;
  usedTemplate: boolean;
};

export async function sendWhatsAppMessage(
  input: SendWhatsAppInput,
): Promise<SendWhatsAppResult> {
  if (!input.to?.trim()) {
    throw new Error(
      "No debtor phone on this invoice. Add a mobile number to the Xero contact.",
    );
  }

  const config = getTwilioConfig();
  const client = getTwilioClient();
  const to = toWhatsAppAddress(input.to);
  const body = draftChaseMessage(input);

  const message = config.contentSid
    ? await client.messages.create({
        from: config.whatsappFrom,
        to,
        contentSid: config.contentSid,
        contentVariables: JSON.stringify(contentVariablesForTemplate(input)),
      })
    : await client.messages.create({
        from: config.whatsappFrom,
        to,
        body,
      });

  if (!message.sid) {
    throw new Error("Twilio did not return a message SID");
  }

  logOutboundMessage({
    contactName: input.customer,
    invoiceId: input.invoiceNumber,
    rung: input.rung,
    channel: "whatsapp",
    messageSid: message.sid,
    body,
  });

  return {
    sid: message.sid,
    to,
    body,
    usedTemplate: Boolean(config.contentSid),
  };
}
