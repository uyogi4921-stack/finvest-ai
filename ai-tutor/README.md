# Finvest AI Tutor

Anthropic-powered chat tutor for the Finvest app. Built on the **Messages API with tool use** (not the Agent SDK — this is a consumer chat). Stack: Next.js (App Router) + Supabase (Postgres + pgvector) + Vercel.

> Status: **Steps 1–3 of 6 — guardrail + tools + RAG.** Module routing, caching, and the eval harness land in later steps.

## RAG (Step 3)

Curated lesson content lives in Supabase pgvector (`supabase/migrations/0001_lesson_chunks.sql`) — a team-editable `lesson_chunks` table, **not** baked into the prompt. Embeddings are **gte-small (384-dim)** via an in-stack Supabase Edge Function (`supabase/functions/embed/`) — no paid embeddings key.

- `lib/rag.ts` `retrieve(query, {module, level, k})` → embed the query → `match_lesson_chunks` RPC (cosine) → top-k chunks → injected into the system prompt's RETRIEVED block.
- The model is told to **prefer retrieved content** over its own memory.
- **Empty-retrieval path:** if Supabase is unconfigured or retrieval fails, `retrieve()` returns `[]` and the prompt tells the model to teach from first principles and flag it (tested).
- Seed: `node scripts/seed-lessons.mjs` (after migrations + `supabase functions deploy embed`).

**Setup (when Supabase creds are in `.env.local`):**
```bash
supabase db push                       # apply migrations
supabase functions deploy embed        # gte-small embeddings
node scripts/seed-lessons.mjs          # load curated chunks
```

## Tools (Step 2)

Defined as Anthropic tool schemas (`lib/tools/index.ts`) with deterministic, injectable handlers; the model drives a tool-use loop (`lib/runModel.ts`).

- **`market_data(ticker)`** — live price/change/52w from Yahoo (no key; `.NS`/`.BO`/US fallback; 30s cache). PE/market-cap are `null` when the source doesn't expose them — the model must say so rather than invent. `MARKET_DATA_DISABLED=1` forces the unavailable path.
- **`calculator(scenario)`** — pure, deterministic: `compound`, `sip`, `position_size`, `portfolio_value`, `pct_change`. Fully unit-tested.
- **`user_state()`** — learner progress/goals/risk from Supabase (`learner_state` table), default-safe when unconfigured. Personalises teaching only.

**Grounding guard** (`lib/grounding.ts`): a second post-check. If the model states a *live* number (a current price/PE/market-cap/today's move) that did **not** come from a `market_data` result this turn, the answer is replaced with an offer to look it up. Worked-example numbers are deliberately left alone.

## How the pieces fit

```
POST /api/chat
  └─ runTutorTurn()                         lib/pipeline.ts
       1. detectAdviceRequest(userText)     lib/guardrail.ts   (pre-check, logs)
       2. buildSystemBlocks(context)        lib/system-prompt.ts
            block 0: frozen Finvest prompt  (prompt-cacheable, Step 5)
            block 1: RETRIEVED + LEARNER     (volatile, Step 3 fills retrieval)
       3. generate()                        lib/anthropic.ts   (Claude, streamed)
            └─ swappable: tests inject a mock model
       4. enforceEducationNotAdvice()       lib/guardrail.ts   (post-check, logs)
            └─ if the output recommends a trade/allocation/price, REPLACE it
               with teachingRedirect() and log `advice_intercepted`
```

The model is **instructed** not to advise (system prompt) and the guardrail is the
**deterministic safety net** that makes a buy/sell/allocation recommendation
architecturally unable to reach the user — required because Finvest is not a
SEBI-registered adviser.

## Guardrail design

- `detectAdviceRequest(text)` — is the *user* fishing for a tip? Adds a per-turn
  steer to the system block and logs `advice_request_detected`. We don't refuse
  the user; we redirect to teaching.
- `scanForAdvice(text)` — does the *assistant* output contain a recommendation?
  Catches: buy/sell/hold directives, "X is a good buy", tailored `N%` allocations,
  price predictions ("will go up", "target price"), and return promises
  ("guaranteed", "multibagger").
- Heuristics are **safety-biased**: a false positive merely reroutes to a still-helpful
  teaching answer; a false negative would be a compliance breach. The post-check
  never lets a recommendation through.

## Run

```bash
cd ai-tutor
npm install
cp .env.example .env.local   # fill ANTHROPIC_API_KEY + Supabase when wiring live
npm test                     # guardrail + adversarial suite (model is mocked — no key needed)
npm run dev                  # Next dev server (needs ANTHROPIC_API_KEY for real chat)
```

## Tests (Step 1)

`tests/guardrail.test.ts`:
- 10 adversarial prompts (advice-fishing in varied phrasings), each paired with a
  worst-case model output — asserts **all are intercepted** and no buy/sell leaks.
- The teaching redirect and legitimate teaching answers are **not** flagged.
- A compliant answer passes through unchanged.

## Model

`claude-opus-4-8`, adaptive thinking, `effort` configurable via `FINVEST_EFFORT`.
Streamed server-side; the guardrail post-check runs on the full text before the
response is returned. (Token-stream-to-client + caching tuning is Step 5.)
