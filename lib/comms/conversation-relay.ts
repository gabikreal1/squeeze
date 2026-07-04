import OpenAI from "openai";

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

export async function generateCallReply(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for Conversation Relay");
  }

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    max_tokens: 120,
    temperature: 0.4,
  });

  return (
    response.choices[0]?.message?.content?.trim() ??
    "Thank you for your time. We will follow up by email."
  );
}
