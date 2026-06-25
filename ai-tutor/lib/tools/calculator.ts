/**
 * Deterministic financial calculator. Pure functions, no I/O, fully unit-tested.
 * The model must route ALL math here (system prompt) — it never computes returns
 * in its head, and a calculation is never presented as advice.
 */

export type CalcScenario =
  | { type: "compound"; principal: number; annualRatePct: number; years: number; compoundsPerYear?: number }
  | { type: "sip"; monthly: number; annualRatePct: number; years: number }
  | { type: "position_size"; capital: number; riskPct: number; entry: number; stop: number }
  | { type: "portfolio_value"; holdings: Array<{ qty: number; price: number }> }
  | { type: "pct_change"; from: number; to: number };

export interface CalcResult {
  type: CalcScenario["type"];
  // result fields vary by type; all rounded to 2dp for display
  [k: string]: number | string | undefined;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function num(name: string, v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`calculator: '${name}' must be a finite number`);
  }
  return v;
}

export function evalCalc(s: CalcScenario): CalcResult {
  switch (s.type) {
    case "compound": {
      const p = num("principal", s.principal);
      const rate = num("annualRatePct", s.annualRatePct) / 100;
      const years = num("years", s.years);
      const m = s.compoundsPerYear ?? 1;
      if (years < 0 || m <= 0) throw new Error("calculator: invalid years/compoundsPerYear");
      const fv = p * Math.pow(1 + rate / m, m * years);
      return { type: "compound", invested: r2(p), futureValue: r2(fv), gain: r2(fv - p) };
    }
    case "sip": {
      const monthly = num("monthly", s.monthly);
      const rate = num("annualRatePct", s.annualRatePct) / 100;
      const years = num("years", s.years);
      const n = Math.round(years * 12);
      const i = rate / 12;
      const invested = monthly * n;
      // FV of an annuity-due (contribution at start of each month)
      const fv = i === 0 ? invested : monthly * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
      return { type: "sip", invested: r2(invested), futureValue: r2(fv), gain: r2(fv - invested), months: n };
    }
    case "position_size": {
      const capital = num("capital", s.capital);
      const riskPct = num("riskPct", s.riskPct);
      const entry = num("entry", s.entry);
      const stop = num("stop", s.stop);
      const perShareRisk = Math.abs(entry - stop);
      if (perShareRisk === 0) throw new Error("calculator: entry and stop cannot be equal");
      const riskAmount = (capital * riskPct) / 100;
      const shares = Math.floor(riskAmount / perShareRisk);
      return {
        type: "position_size",
        riskAmount: r2(riskAmount),
        perShareRisk: r2(perShareRisk),
        shares,
        positionCost: r2(shares * entry),
      };
    }
    case "portfolio_value": {
      if (!Array.isArray(s.holdings) || s.holdings.length === 0) {
        throw new Error("calculator: holdings must be a non-empty array");
      }
      const total = s.holdings.reduce((sum, h) => sum + num("qty", h.qty) * num("price", h.price), 0);
      return { type: "portfolio_value", total: r2(total), positions: s.holdings.length };
    }
    case "pct_change": {
      const from = num("from", s.from);
      const to = num("to", s.to);
      if (from === 0) throw new Error("calculator: 'from' cannot be zero");
      return { type: "pct_change", changePct: r2(((to - from) / from) * 100), change: r2(to - from) };
    }
    default: {
      const _exhaustive: never = s;
      throw new Error(`calculator: unknown scenario ${(_exhaustive as { type: string }).type}`);
    }
  }
}
