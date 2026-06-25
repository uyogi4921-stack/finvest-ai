import { buildSystemBlocks } from "./system-prompt";
import {
  detectAdviceRequest,
  enforceEducationNotAdvice,
  consoleLogger,
  type GuardrailLogger,
} from "./guardrail";
import { scanForUnsourcedNumbers, groundingRedirect } from "./grounding";
import { defaultRunModel, type RunModel } from "./runModel";
import type { ToolContext } from "./tools";
import type { ChatMessage, TutorContext, TurnResult } from "./types";

/** Back-compat string generator (Step 1 tests inject this). */
export type Generate = (args: {
  system: ReturnType<typeof buildSystemBlocks>;
  messages: Array<{ role: "user" | "assistant"; content: unknown }>;
}) => Promise<string>;

export interface TurnDeps {
  runModel?: RunModel;
  generate?: Generate; // simpler string-only model for guardrail tests
  log?: GuardrailLogger;
  toolCtx?: ToolContext;
}

const ADVICE_TURN_STEER =
  "\n\n[OPERATOR NOTE — this turn] The learner is fishing for a buy/sell/allocation call. Do NOT answer the buy/sell question. Name that you teach concepts, then teach the evaluation framework (fundamentals, risk, diversification). Redirect from 'what to do' to 'how to think about it.'";

function resolveRunModel(deps?: TurnDeps): RunModel {
  if (deps?.runModel) return deps.runModel;
  if (deps?.generate) {
    const g = deps.generate;
    return async ({ system, messages }) => ({
      text: await g({ system, messages }),
      toolsUsed: [],
      marketFacts: false,
    });
  }
  return defaultRunModel;
}

/**
 * One tutor turn: guardrail-wrapped model with a tool-use loop.
 *   pre-check (advice request → steer + log)
 *   -> model (+ tools)
 *   -> post-check 1: education-not-advice (intercept recommendations)
 *   -> post-check 2: grounding (intercept unsourced live numbers)
 */
export async function runTutorTurn(args: {
  userText: string;
  history?: ChatMessage[];
  context: TutorContext;
  deps?: TurnDeps;
}): Promise<TurnResult> {
  const runModel = resolveRunModel(args.deps);
  const log = args.deps?.log ?? consoleLogger;

  const req = detectAdviceRequest(args.userText);
  if (req.flagged) {
    log({ type: "advice_request_detected", userText: args.userText, reasons: req.reasons, ts: new Date().toISOString() });
  }

  const system = buildSystemBlocks(args.context);
  if (req.flagged) system[1].text += ADVICE_TURN_STEER;

  const messages = [
    ...(args.history ?? []).map((m) => ({ role: m.role, content: m.content as unknown })),
    { role: "user" as const, content: args.userText as unknown },
  ];

  const out = await runModel({ system, messages, toolCtx: args.deps?.toolCtx });

  // Guard 1 — education, not advice
  const advice = enforceEducationNotAdvice({ userText: args.userText, assistantText: out.text, log });
  if (advice.intercepted) {
    return {
      text: advice.text,
      guardrail: { userAskedForAdvice: req.flagged, intercepted: true, reasons: advice.reasons },
      grounding: { intercepted: false, reasons: [], marketFactsUsed: out.marketFacts },
      toolsUsed: out.toolsUsed,
      retrievalUsed: args.context.retrieved.length > 0,
    };
  }

  // Guard 2 — grounding (no unsourced live numbers)
  const ground = scanForUnsourcedNumbers(out.text, out.marketFacts);
  if (ground.flagged) {
    log({ type: "advice_intercepted", userText: args.userText, assistantText: out.text, reasons: ["grounding:" + ground.reasons.join(",")], ts: new Date().toISOString() });
    return {
      text: groundingRedirect(),
      guardrail: { userAskedForAdvice: req.flagged, intercepted: false, reasons: req.reasons },
      grounding: { intercepted: true, reasons: ground.reasons, marketFactsUsed: out.marketFacts },
      toolsUsed: out.toolsUsed,
      retrievalUsed: args.context.retrieved.length > 0,
    };
  }

  return {
    text: out.text,
    guardrail: { userAskedForAdvice: req.flagged, intercepted: false, reasons: req.reasons },
    grounding: { intercepted: false, reasons: [], marketFactsUsed: out.marketFacts },
    toolsUsed: out.toolsUsed,
    retrievalUsed: args.context.retrieved.length > 0,
  };
}
