import { describe, it, expect, beforeEach } from "vitest";
import { executeTool } from "@/lib/tools";
import { marketData, _clearMarketCache } from "@/lib/tools/marketData";
import { scanForUnsourcedNumbers } from "@/lib/grounding";
import { runTutorTurn } from "@/lib/pipeline";
import type { TutorContext } from "@/lib/types";

const CTX: TutorContext = { retrieved: [], learner: { level: "beginner" } };

// A fake Yahoo chart response for AAPL.
const fakeYahoo = (price: number, prev: number) =>
  ({
    ok: true,
    json: async () => ({
      chart: { result: [{ meta: { symbol: "AAPL", currency: "USD", regularMarketPrice: price, chartPreviousClose: prev, regularMarketDayHigh: price + 1, regularMarketDayLow: prev - 1, fiftyTwoWeekHigh: 320, fiftyTwoWeekLow: 160 } }] },
    }),
  }) as unknown as Response;

beforeEach(() => {
  _clearMarketCache();
  delete process.env.MARKET_DATA_DISABLED;
});

describe("market_data", () => {
  it("returns a quote from the source (mocked fetch)", async () => {
    const q = await marketData("AAPL", { fetch: async () => fakeYahoo(298, 295) });
    expect(q.ok).toBe(true);
    expect(q.price).toBe(298);
    expect(q.changePct).toBe(1.02);
    expect(q.pe).toBeNull(); // honest: not available without auth
  });

  it("reports unavailable instead of inventing data", async () => {
    process.env.MARKET_DATA_DISABLED = "1";
    const q = await marketData("RELIANCE", { fetch: async () => fakeYahoo(1, 1) });
    expect(q.ok).toBe(false);
    expect(q.price).toBeUndefined();
    expect(q.error).toMatch(/unavailable/i);
  });

  it("executeTool flags a real quote as a market fact", async () => {
    const res = await executeTool("market_data", { ticker: "AAPL" }, { fetch: async () => fakeYahoo(298, 295) });
    expect(res.ok).toBe(true);
    expect(res.isMarketFact).toBe(true);
  });

  it("executeTool calculator runs deterministically", async () => {
    const res = await executeTool("calculator", { type: "pct_change", from: 100, to: 125 });
    expect(res.ok).toBe(true);
    expect((res.data as { changePct: number }).changePct).toBe(25);
    expect(res.isMarketFact).toBe(false);
  });
});

describe("grounding guard — numbers must trace to a tool", () => {
  it("flags a live price claim with no market fact", () => {
    expect(scanForUnsourcedNumbers("Reliance is trading at ₹2,450 right now.", false).flagged).toBe(true);
    expect(scanForUnsourcedNumbers("TCS PE is 28 currently.", false).flagged).toBe(true);
  });

  it("allows the same claim when a market fact was sourced", () => {
    expect(scanForUnsourcedNumbers("Reliance is trading at ₹2,450 right now.", true).flagged).toBe(false);
  });

  it("does NOT flag worked-example numbers", () => {
    expect(scanForUnsourcedNumbers("If you invest ₹10,000 at 12% for 10 years it grows a lot.", false).flagged).toBe(false);
    expect(scanForUnsourcedNumbers("A P/E ratio is price divided by earnings.", false).flagged).toBe(false);
  });
});

describe("pipeline grounding", () => {
  const mockModel = (text: string, marketFacts: boolean) => async () => ({ text, toolsUsed: marketFacts ? ["market_data"] : [], marketFacts });

  it("refuses to state a price when market_data was unavailable", async () => {
    const res = await runTutorTurn({
      userText: "What's TCS trading at?",
      context: CTX,
      deps: { runModel: mockModel("TCS is currently trading at ₹4,100.", false), log: () => {} },
    });
    expect(res.grounding.intercepted).toBe(true);
    expect(res.text).not.toMatch(/4,?100/);
    expect(res.text).toMatch(/look up|fetch|live/i);
  });

  it("lets a price through when it came from market_data", async () => {
    const grounded = "Based on live data, TCS is around ₹4,100 — want me to explain what that price reflects?";
    const res = await runTutorTurn({
      userText: "What's TCS trading at?",
      context: CTX,
      deps: { runModel: mockModel(grounded, true), log: () => {} },
    });
    expect(res.grounding.intercepted).toBe(false);
    expect(res.text).toBe(grounded);
  });
});
