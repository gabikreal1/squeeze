import OpenAI from "openai";
import { logCall } from "./call-logger";

export type CallContext = {
  contactName: string;
  invoiceAmount: number;
  daysOverdue: number;
  invoiceNumber?: string;
};

const SYSTEM_PROMPT = `You are Squeeze, an AI credit controller calling on behalf of a small business.
Rules:
- Disclose at the start that you are an AI assistant calling on behalf of the business.
- Be professional, B2B, proportionate. One topic: payment of the overdue invoice.
- Keep responses under 2 sentences.
- If the debtor promises a payment date, confirm it and thank them.
- If they dispute, acknowledge and say the business will follow up in writing.
- Max 3 conversational turns then end politely.`;

export function buildCallSystemPrompt(context: CallContext): string {
  return `${SYSTEM_PROMPT}

Invoice: £${context.invoiceAmount.toLocaleString("en-GB")} from ${context.contactName}, ${context.daysOverdue} days overdue.`;
}

export function buildInitialGreeting(context: CallContext): string {
  const invoiceRef = context.invoiceNumber ? ` (${context.invoiceNumber})` : "";
  return (
    `Hello, this is Squeeze, an AI assistant calling on behalf of the business. ` +
    `I'm calling about an overdue invoice from ${context.contactName} for ` +
    `£${context.invoiceAmount.toLocaleString("en-GB")}${invoiceRef}, ` +
    `${context.daysOverdue} days overdue. ` +
    `When can we expect payment?`
  );
}

export function buildOpeningMessages(
  context: CallContext,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const greeting = buildInitialGreeting(context);
  return [
    { role: "system", content: buildCallSystemPrompt(context) },
    { role: "assistant", content: greeting },
  ];
}

export async function generateCallReply(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  callSid?: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for AI call replies");
  }

  logCall("voice.openai.start", {
    callSid,
    meta: { model: "gpt-4o", messageCount: messages.length },
  });

  const started = Date.now();
  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 120,
      temperature: 0.4,
    });

    const reply =
      response.choices[0]?.message?.content?.trim() ??
      "Thank you for your time. We will follow up by email.";

    logCall("voice.openai.ok", {
      callSid,
      ms: Date.now() - started,
      meta: {
        finishReason: response.choices[0]?.finish_reason,
        usage: response.usage,
        replyPreview: reply.slice(0, 80),
      },
    });

    return reply;
  } catch (error) {
    logCall("voice.openai.error", {
      callSid,
      ms: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
