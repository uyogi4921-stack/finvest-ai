/**
 * GROUNDING guard: any CURRENT price / market figure / live fact must trace to
 * a tool result. This catches the model stating a *live* number it didn't get
 * from market_data this turn. Worked-example numbers ("if you invest ₹10,000 at
 * 12%...") are NOT live claims and are intentionally left alone.
 */

export interface GroundingScan {
  flagged: boolean;
  reasons: string[];
}

// Phrases that present a number as a CURRENT/LIVE market fact.
const LIVE_CLAIM_PATTERNS: Array<[RegExp, string]> = [
  [/\b(trading|priced|quoted|changing\s+hands)\s+(at|around|near)\s+[₹$rs.]*\s?\d/i, "states a live trading price"],
  [/\b(current|live|today'?s|latest|real[-\s]?time)\s+(price|value|level|quote)\b[\s\S]{0,18}[₹$]?\s?\d/i, "states a current price/level"],
  [/\b(is|was|now|closed|opened|stands|sits)\s+(at|around)\s+[₹$]\s?\d/i, "states a price as fact"],
  [/\b(p\/?e|pe\s+ratio|market\s?cap|market\s+capitali[sz]ation|p\/?b|eps|dividend\s+yield)\s*(of|is|at|=|:|stands\s+at)\s*[₹$]?\s?\d/i, "states a live fundamental"],
  [/\b(up|down|gained|lost|fell|rose|jumped|dropped)\s+\d+(\.\d+)?\s?%\s+(today|so\s+far|this\s+(week|session|month)|intraday|right\s+now)\b/i, "states today's move as fact"],
  [/[₹$]\s?\d[\d,]*\.?\d*\s+(per\s+share|a\s+share|currently|right\s+now|as\s+of\s+(today|now))\b/i, "states a per-share price as fact"],
];

export function scanForUnsourcedNumbers(
  assistantText: string,
  hasMarketFacts: boolean,
): GroundingScan {
  if (hasMarketFacts) return { flagged: false, reasons: [] };
  const reasons: string[] = [];
  for (const [re, why] of LIVE_CLAIM_PATTERNS) if (re.test(assistantText)) reasons.push(why);
  return { flagged: reasons.length > 0, reasons: Array.from(new Set(reasons)) };
}

/** Safe response when the model stated a live figure it couldn't source. */
export function groundingRedirect(): string {
  return (
    "I don't want to quote a number I haven't actually pulled — prices and fundamentals move, and I only state figures that come from a live lookup. " +
    "Want me to fetch the current data for that ticker? I can also explain how to read whatever number comes back."
  );
}
