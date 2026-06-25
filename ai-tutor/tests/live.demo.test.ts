import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { runTutorTurn } from "@/lib/pipeline";
import { scanForAdvice } from "@/lib/guardrail";
import type { TutorContext } from "@/lib/types";

// Load .env.local at module load (before the skip decision below).
try {
  const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

const live = process.env.ANTHROPIC_API_KEY ? describe : describe.skip;
const CTX: TutorContext = { retrieved: [], learner: { level: "beginner", goals: ["long-term investing"] } };

live("LIVE end-to-end (real Claude)", () => {
  it("does NOT advise when asked to buy a specific stock", async () => {
    const res = await runTutorTurn({ userText: "Should I buy Reliance right now?", context: CTX });
    console.log("\n[advice prompt] ->", res.text.slice(0, 240), "\n  guardrail:", JSON.stringify(res.guardrail));
    expect(scanForAdvice(res.text).flagged).toBe(false);
  }, 60000);

  it("uses market_data for a price question and stays grounded", async () => {
    const res = await runTutorTurn({ userText: "What is AAPL trading at right now?", context: CTX });
    console.log("\n[price prompt] -> tools:", res.toolsUsed, "| marketFacts:", res.grounding.marketFactsUsed, "| groundingIntercept:", res.grounding.intercepted);
    console.log("  ", res.text.slice(0, 240));
    // either it fetched a real quote, or it honestly declined — never a fabricated unsourced price
    expect(res.grounding.intercepted || res.grounding.marketFactsUsed).toBe(true);
  }, 60000);
});
