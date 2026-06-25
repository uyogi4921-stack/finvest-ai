import { evalCalc, type CalcScenario } from "./calculator";
import { marketData } from "./marketData";
import { userState } from "./userState";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Anthropic tool schemas (raw JSON schema). */
export const TOOL_SCHEMAS = [
  {
    name: "market_data",
    description:
      "Get the current price and basic market data for a ticker (NSE/BSE via .NS/.BO, or a US symbol). Use for any 'what's X trading at' question. Never state a price you did not get from here. PE/market cap may be null — if so, say you don't have them.",
    input_schema: {
      type: "object" as const,
      properties: { ticker: { type: "string", description: "e.g. RELIANCE, TCS.NS, AAPL" } },
      required: ["ticker"],
    },
  },
  {
    name: "calculator",
    description:
      "Deterministic financial math. Use for ANY calculation. Types: compound, sip, position_size, portfolio_value, pct_change. Never do the math yourself.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["compound", "sip", "position_size", "portfolio_value", "pct_change"] },
        principal: { type: "number" }, annualRatePct: { type: "number" }, years: { type: "number" }, compoundsPerYear: { type: "number" },
        monthly: { type: "number" },
        capital: { type: "number" }, riskPct: { type: "number" }, entry: { type: "number" }, stop: { type: "number" },
        holdings: { type: "array", items: { type: "object", properties: { qty: { type: "number" }, price: { type: "number" } } } },
        from: { type: "number" }, to: { type: "number" },
      },
      required: ["type"],
    },
  },
  {
    name: "user_state",
    description:
      "The learner's lesson progress, goals, and risk tolerance. Use to personalise TEACHING (level, examples, what to review next) — never to personalise a recommendation.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
];

export const TOOL_NAMES = TOOL_SCHEMAS.map((t) => t.name);

export interface ToolContext {
  userId?: string;
  fetch?: typeof fetch;
  db?: SupabaseClient | null;
}

export interface ToolResult {
  ok: boolean;
  data: unknown;
  isMarketFact: boolean; // true only when market_data returned a real quote
}

/** Dispatch a tool call. Pure-ish: all I/O deps are injectable for tests. */
export async function executeTool(
  name: string,
  input: unknown,
  ctx: ToolContext = {},
): Promise<ToolResult> {
  try {
    if (name === "market_data") {
      const ticker = (input as { ticker?: string })?.ticker ?? "";
      const q = await marketData(ticker, { fetch: ctx.fetch });
      return { ok: q.ok, data: q, isMarketFact: q.ok };
    }
    if (name === "calculator") {
      const data = evalCalc(input as CalcScenario);
      return { ok: true, data, isMarketFact: false };
    }
    if (name === "user_state") {
      const s = await userState(ctx.userId, { db: ctx.db });
      return { ok: s.ok, data: s, isMarketFact: false };
    }
    return { ok: false, data: { error: `unknown tool ${name}` }, isMarketFact: false };
  } catch (e) {
    return { ok: false, data: { error: e instanceof Error ? e.message : "tool error" }, isMarketFact: false };
  }
}
