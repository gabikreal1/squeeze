import OpenAI from "openai";
import type { ApiForecastResponse } from "../api/format-forecast";
import {
  COPILOT_TOOL_DEFINITIONS,
  executeCopilotTool,
  toolLabel,
} from "./copilot-tools";

export type CopilotMessage = {
  role: "user" | "assistant";
  text: string;
};

export type CopilotChatResult = {
  text: string;
  tools: string[];
};

const MAX_TOOL_ROUNDS = 6;

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for Finance Copilot");
  }
  return new OpenAI({ apiKey });
}

function getModel(): string {
  return process.env.COPILOT_MODEL?.trim() || "gpt-4o-mini";
}

function buildCopilotSystemPrompt(forecast: ApiForecastResponse): string {
  const dataSource =
    forecast.source === "xero"
      ? "live Xero data (synced from the dashboard)"
      : "demo scenario";

  return `You are Squeeze Finance Copilot, an AI credit controller for ${forecast.orgName ?? "Maya's Catering Co."}.
Data source: ${dataSource}.

Rules:
- ALWAYS call tools before stating numbers, dates, customer names, or recommendations. Never guess.
- Be concise: 2–4 sentences unless drafting a message or comparing plans in detail.
- B2B professional tone. Format amounts in GBP with £.
- Respect dontSqueeze flags — do not recommend aggressive collection on those accounts.
- Draft messages in quotes when asked.
- If tools cannot answer, say so honestly.`;
}

function toOpenAiMessages(
  systemPrompt: string,
  messages: CopilotMessage[],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  return [
    { role: "system", content: systemPrompt },
    ...messages.map(
      (m): OpenAI.Chat.ChatCompletionMessageParam => ({
        role: m.role,
        content: m.text,
      }),
    ),
  ];
}

async function runToolLoop(
  openai: OpenAI,
  systemPrompt: string,
  messages: CopilotMessage[],
  forecast: ApiForecastResponse,
): Promise<CopilotChatResult> {
  const transcript: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...toOpenAiMessages(systemPrompt, messages),
  ];
  const toolsUsed: string[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: transcript,
      tools: COPILOT_TOOL_DEFINITIONS,
      tool_choice: "auto",
      max_tokens: 500,
      temperature: 0.4,
    });

    const choice = response.choices[0]?.message;
    if (!choice) {
      break;
    }

    if (!choice.tool_calls?.length) {
      return {
        text:
          choice.content?.trim() ??
          "I couldn't generate a response. Please try again.",
        tools: toolsUsed,
      };
    }

    transcript.push(choice);

    for (const call of choice.tool_calls) {
      if (call.type !== "function") continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<
          string,
          unknown
        >;
      } catch {
        args = {};
      }

      const result = executeCopilotTool(
        call.function.name,
        args,
        forecast,
      );
      toolsUsed.push(toolLabel(call.function.name, args));

      transcript.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    text: "I hit the tool limit before finishing. Please ask a narrower question.",
    tools: toolsUsed,
  };
}

export async function runCopilotChat(
  messages: CopilotMessage[],
  forecast: ApiForecastResponse,
): Promise<CopilotChatResult> {
  const openai = getOpenAiClient();
  const systemPrompt = buildCopilotSystemPrompt(forecast);
  return runToolLoop(openai, systemPrompt, messages, forecast);
}

/** Dynamic opening line — uses tools + LLM, not hardcoded copy. */
export async function runCopilotGreeting(
  forecast: ApiForecastResponse,
): Promise<CopilotChatResult> {
  const openai = getOpenAiClient();
  const systemPrompt = `${buildCopilotSystemPrompt(forecast)}

Generate a 1–2 sentence morning briefing for Maya. Call get_forecast and get_gap_drivers first.
If gapClosed is true, congratulate on payment received. Otherwise name the gap amount and day.
End with a short invitation to ask questions. No bullet points.`;

  return runToolLoop(openai, systemPrompt, [], forecast);
}

export function isCopilotConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
