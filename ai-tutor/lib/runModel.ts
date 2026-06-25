import type Anthropic from "@anthropic-ai/sdk";
import { getClient, MODEL, EFFORT, type SystemBlocks } from "./anthropic";
import { TOOL_SCHEMAS, executeTool, type ToolContext } from "./tools";

export interface RunModelResult {
  text: string;
  toolsUsed: string[];
  /** true if a market_data call returned a real live quote this turn */
  marketFacts: boolean;
}

export type RunModel = (args: {
  system: SystemBlocks;
  messages: Array<{ role: "user" | "assistant"; content: unknown }>;
  toolCtx?: ToolContext;
}) => Promise<RunModelResult>;

const MAX_STEPS = 5;

/** Real tool-use loop: model ⇄ tools until it produces a final answer. */
export const defaultRunModel: RunModel = async ({ system, messages, toolCtx }) => {
  const client = getClient();
  const msgs = messages.slice() as Anthropic.MessageParam[];
  const toolsUsed: string[] = [];
  let marketFacts = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    const params = {
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: "adaptive" as const },
      output_config: { effort: EFFORT },
      system,
      tools: TOOL_SCHEMAS,
      messages: msgs,
    };
    const final = await client.messages
      .stream(params as unknown as Anthropic.MessageStreamParams)
      .finalMessage();

    if (final.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of final.content) {
        if (block.type !== "tool_use") continue;
        toolsUsed.push(block.name);
        const res = await executeTool(block.name, block.input, toolCtx ?? {});
        if (res.isMarketFact) marketFacts = true;
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(res.data),
        });
      }
      msgs.push({ role: "assistant", content: final.content });
      msgs.push({ role: "user", content: toolResults });
      continue;
    }

    const text = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return { text, toolsUsed, marketFacts };
  }
  return { text: "(I got stuck looping on tools — try rephrasing.)", toolsUsed, marketFacts };
};
