/** LLM tool-calling agent — Phase 2: classify replies, draft nudges/LBA, explain recommendations. */
export const AGENT_TOOLS = [
  "getForecast",
  "rankGap",
  "recommend",
  "sendMessage",
  "placeCall",
  "draftLBA",
] as const;
