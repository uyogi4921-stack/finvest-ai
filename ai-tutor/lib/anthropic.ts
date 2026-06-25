import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.FINVEST_MODEL ?? "claude-opus-4-8";
export const EFFORT = (process.env.FINVEST_EFFORT ?? "medium") as
  | "low"
  | "medium"
  | "high";

let _client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export type SystemBlocks = Array<{
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}>;

/**
 * The model call, isolated so the pipeline can be tested with a mock.
 * Streams server-side (avoids HTTP timeouts) and returns the final text.
 * Tools are wired in Step 2; for now this is plain chat.
 */
export async function generateWithClaude(args: {
  system: SystemBlocks;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  const client = getClient();
  // `thinking: adaptive` and `output_config.effort` are current Messages API
  // features whose TS types lag in this SDK version — cast to send them.
  const params = {
    model: MODEL,
    max_tokens: 2048,
    thinking: { type: "adaptive" as const },
    output_config: { effort: EFFORT },
    system: args.system,
    messages: args.messages,
  };
  const stream = client.messages.stream(
    params as unknown as Anthropic.MessageStreamParams,
  );

  const final = await stream.finalMessage();
  return final.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
