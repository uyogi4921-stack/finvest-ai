import { describe, it, expect } from "vitest";
import { evalCalc } from "@/lib/tools/calculator";

describe("calculator — deterministic math", () => {
  it("compound interest (annual)", () => {
    const r = evalCalc({ type: "compound", principal: 100000, annualRatePct: 12, years: 10 });
    expect(r.futureValue).toBe(310584.82); // 100000 * 1.12^10
    expect(r.gain).toBe(210584.82);
  });

  it("compound with monthly compounding", () => {
    const r = evalCalc({ type: "compound", principal: 1000, annualRatePct: 12, years: 1, compoundsPerYear: 12 });
    expect(r.futureValue).toBe(1126.83);
  });

  it("SIP future value (annuity-due)", () => {
    const r = evalCalc({ type: "sip", monthly: 5000, annualRatePct: 12, years: 10 });
    expect(r.invested).toBe(600000);
    expect(r.months).toBe(120);
    expect(r.futureValue).toBe(1161695.38);
  });

  it("SIP at 0% return = just the contributions", () => {
    const r = evalCalc({ type: "sip", monthly: 1000, annualRatePct: 0, years: 2 });
    expect(r.futureValue).toBe(24000);
    expect(r.gain).toBe(0);
  });

  it("position sizing from risk", () => {
    const r = evalCalc({ type: "position_size", capital: 100000, riskPct: 2, entry: 200, stop: 190 });
    expect(r.riskAmount).toBe(2000);
    expect(r.perShareRisk).toBe(10);
    expect(r.shares).toBe(200);
    expect(r.positionCost).toBe(40000);
  });

  it("portfolio value", () => {
    const r = evalCalc({ type: "portfolio_value", holdings: [ { qty: 4, price: 230.1 }, { qty: 3, price: 435.3 } ] });
    expect(r.total).toBe(2226.3);
    expect(r.positions).toBe(2);
  });

  it("percent change", () => {
    expect(evalCalc({ type: "pct_change", from: 10000, to: 11500 }).changePct).toBe(15);
    expect(evalCalc({ type: "pct_change", from: 200, to: 150 }).changePct).toBe(-25);
  });

  it("rejects bad input", () => {
    expect(() => evalCalc({ type: "pct_change", from: 0, to: 5 })).toThrow();
    expect(() => evalCalc({ type: "position_size", capital: 1000, riskPct: 1, entry: 100, stop: 100 })).toThrow();
    // @ts-expect-error invalid number
    expect(() => evalCalc({ type: "compound", principal: "x", annualRatePct: 10, years: 5 })).toThrow();
  });
});
