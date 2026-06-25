/**
 * EDUCATION-NOT-ADVICE guardrail.
 *
 * Finvest must be architecturally incapable of giving personalized investment
 * advice (SEBI: we are not a registered adviser). The model is instructed not
 * to advise (system prompt), and this module is the deterministic safety net:
 *   - detectAdviceRequest()  — is the USER fishing for a buy/sell/allocation call?
 *   - scanForAdvice()        — does the ASSISTANT output contain a recommendation?
 *   - enforceEducationNotAdvice() — post-check: if flagged, REPLACE with a
 *                                   teaching redirect and log the event.
 *
 * Heuristics are intentionally safety-biased: a false positive merely reroutes
 * to a (still helpful) teaching answer; a false negative would be a compliance
 * breach. The guardrail never lets a buy/sell/allocation/price-promise through.
 */

export interface AdviceScan {
  flagged: boolean;
  reasons: string[];
}

export interface GuardrailEvent {
  type: "advice_intercepted" | "advice_request_detected";
  userText: string;
  assistantText?: string;
  reasons: string[];
  ts: string;
}

/** Pluggable sink. Defaults to console; Step 3 can swap in a Supabase logger. */
export type GuardrailLogger = (e: GuardrailEvent) => void;

export const consoleLogger: GuardrailLogger = (e) => {
  // eslint-disable-next-line no-console
  console.warn(`[guardrail] ${e.type}`, { reasons: e.reasons, ts: e.ts });
};

// ── USER side: is the user asking for advice / a tip? ──
const ADVICE_REQUEST_PATTERNS: Array<[RegExp, string]> = [
  [/\b(should|shall|do|can|would|could)\s+i\s+(buy|sell|short|hold|book|exit|invest|dump|add|accumulate|put\s+money)\b/i, "asks should-I buy/sell/invest"],
  [/\bwhat\s+(should|do|to|can)\s+i\s+(buy|sell|invest|do\s+with|put\s+my\s+money)\b/i, "asks what to buy/invest"],
  [/\bwhere\s+(should|do|can)\s+i\s+(invest|put\s+(my\s+)?money)\b/i, "asks where to invest"],
  [/\bis\s+[\w.&\- ]{1,30}?\s+(a\s+)?(good|safe|smart|solid|great|worth|bad)\s+(buy|sell|investment|pick|bet|hold|share|stock)\b/i, "asks is-X-a-good-buy"],
  [/\bwhich\s+(stock|share|fund|crypto|coin|etf)s?\s+(should|to|do|can)\s+(i\s+)?(buy|pick|invest|choose|get)\b/i, "asks which stock to buy"],
  [/\b(recommend|suggest|give\s+me|tip\s+me|pick)\b[\s\S]{0,25}\b(stock|share|fund|crypto|coin|etf|investment)\b/i, "asks for a recommendation"],
  [/\b(good|right|best)\s+time\s+to\s+(buy|sell|invest|enter|exit|book)\b/i, "asks for market timing"],
  [/\b(buy|sell)\s+or\s+(sell|buy|hold)\b/i, "asks buy-or-sell"],
  [/\bhot\s+(stock|tip|pick)s?\b/i, "asks for hot tips"],
  [/\bwill\s+[\w.&-]+\s+(go\s+up|rise|fall|crash|double|moon|drop)\b/i, "asks for a price prediction"],
  [/\bhow\s+much\s+(should|do)\s+i\s+(invest|put)\b/i, "asks for a tailored amount"],
];

export function detectAdviceRequest(userText: string): AdviceScan {
  const reasons: string[] = [];
  for (const [re, why] of ADVICE_REQUEST_PATTERNS) if (re.test(userText)) reasons.push(why);
  return { flagged: reasons.length > 0, reasons };
}

// ── ASSISTANT side: did the model produce a recommendation? ──
const ADVICE_OUTPUT_PATTERNS: Array<[RegExp, string]> = [
  [/\b(you|u)\s+(should|ought\s+to|need\s+to|must|could|gotta|may\s+want\s+to|might\s+want\s+to)\s+(buy|sell|short|hold|dump|book|exit|add|accumulate|pick\s+up|invest\s+in)\b/i, "directs user to buy/sell"],
  [/\b(i|we)\s+(recommend|suggest|advise|would\s+recommend|'d\s+recommend|strongly\s+recommend|would\s+suggest|'d\s+suggest)\b/i, "explicit recommendation"],
  [/\bmy\s+(recommendation|advice|suggestion|pick|call)\s+(is|would\s+be)\b/i, "states a recommendation"],
  [/\b(go\s+ahead\s+and|i'?d\s+go\s+with|i'?d|definitely)\s+(buy|sell|short|hold|grab|pick)\b/i, "endorses a trade"],
  [/\b(buy|sell|short|exit|dump)\s+(it|this|that|them|those)\b/i, "buy/sell directive"],
  [/\b(buy|sell|short|exit|dump)\b[\s\S]{0,25}\b(now|today|right\s+now|immediately|asap|at\s+these\s+levels|this\s+(week|month|dip))\b/i, "buy/sell directive"],
  [/\bbook\s+(your\s+)?(profits?|gains?)\b/i, "advises booking profits"],
  [/\bis\s+(a|an)?\s*(good|great|solid|strong|smart|safe|excellent|must|sure|terrible|bad)\s*(buy|sell|investment|pick|bet|hold|entry)\b/i, "labels something a good/bad buy"],
  [/\b(worth\s+(buying|selling|holding)|i'?d\s+(buy|sell|avoid|hold)|stay\s+away\s+from|steer\s+clear\s+of|i'?d\s+stay\s+out)\b/i, "advises for/against a security"],
  [/\b(put|allocate|invest|keep|move)\s+\d{1,3}\s?%/i, "tailored % allocation"],
  [/\b\d{1,3}\s?%\s+(in|into|of\s+your\s+(portfolio|money|capital|savings))\b/i, "tailored % allocation"],
  [/\b(will|gonna|going\s+to|set\s+to|expected\s+to|likely\s+to)\s+(go\s+up|rise|jump|surge|reach|hit|double|triple|moon|rally|soar|crash|fall|drop|tank)\b/i, "predicts price movement"],
  [/\b(guaranteed|assured|sure[-\s]?shot|risk[-\s]?free|can'?t\s+lose|definitely\s+(rise|go\s+up|profit|gain)|multibagger)\b/i, "promises returns"],
  [/\b(price\s+target|target\s+price|fair\s+value\s+is\s+₹?\d)\b/i, "gives a price target"],
];

export function scanForAdvice(assistantText: string): AdviceScan {
  const reasons: string[] = [];
  for (const [re, why] of ADVICE_OUTPUT_PATTERNS) if (re.test(assistantText)) reasons.push(why);
  return { flagged: reasons.length > 0, reasons: Array.from(new Set(reasons)) };
}

/**
 * The safe teaching redirect used when the model output is intercepted.
 * Carefully worded so it does NOT trip scanForAdvice itself.
 */
export function teachingRedirect(): string {
  return (
    "I'm going to pull back here — I'm a tutor, not a registered adviser, so I can't tell you what to do with your money. What I *can* do is teach you the framework to weigh it yourself. 🙂\n\n" +
    "When evaluating any company, learners usually look at three things:\n" +
    "• **Business & fundamentals** — what it earns, its debt, and ratios like P/E and ROE (always compared within the same sector).\n" +
    "• **Risk** — how much the price swings, and what could go wrong. No single name is ever a sure thing.\n" +
    "• **Fit & diversification** — why spreading across sectors cushions any one stock falling.\n\n" +
    "Want me to walk through how to read fundamentals, or explain what risk really means with a quick example?"
  );
}

/**
 * Post-check. If the assistant output recommends a trade / allocation / price
 * promise, replace it with the teaching redirect and log the event.
 */
export function enforceEducationNotAdvice(args: {
  userText: string;
  assistantText: string;
  log?: GuardrailLogger;
}): { text: string; intercepted: boolean; reasons: string[] } {
  const log = args.log ?? consoleLogger;
  const scan = scanForAdvice(args.assistantText);
  if (!scan.flagged) return { text: args.assistantText, intercepted: false, reasons: [] };

  log({
    type: "advice_intercepted",
    userText: args.userText,
    assistantText: args.assistantText,
    reasons: scan.reasons,
    ts: new Date().toISOString(),
  });
  return { text: teachingRedirect(), intercepted: true, reasons: scan.reasons };
}
