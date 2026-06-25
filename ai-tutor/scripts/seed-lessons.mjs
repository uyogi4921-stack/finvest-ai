// Seed curated lesson chunks into Supabase pgvector.
// Run AFTER applying migrations + deploying the `embed` Edge Function:
//   node scripts/seed-lessons.mjs
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local"); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

// Curated, team-editable content. Keep chunks small + single-idea.
const CHUNKS = [
  { lesson_id: "what-is-investing", module: "market-basics", topic: "investing", level: "beginner",
    content: "Investing means buying assets (like stocks or funds) so your money can grow faster than inflation. In India, inflation runs ~5-6%/year, so idle cash loses value. Only invest money you won't need for 3-5 years." },
  { lesson_id: "stocks-vs-bonds", module: "market-basics", topic: "instruments", level: "beginner",
    content: "A stock is part-ownership of a company (higher risk, higher long-term return). A bond is lending money for fixed interest (lower risk, lower return). Most portfolios hold both." },
  { lesson_id: "diversification", module: "market-basics", topic: "risk", level: "all",
    content: "Diversification means spreading money across sectors and asset classes so one company's fall doesn't sink your whole portfolio. It is the most proven way for retail investors to reduce risk." },
  { lesson_id: "pe-ratio", module: "reading-a-company", topic: "valuation", level: "intermediate",
    content: "P/E ratio = share price ÷ earnings per share. It shows how much you pay per rupee of profit. A high P/E can mean the market expects growth — or that the stock is expensive. Always compare P/E within the same sector." },
  { lesson_id: "reading-fundamentals", module: "reading-a-company", topic: "fundamentals", level: "intermediate",
    content: "Key fundamentals: revenue and profit growth, debt-to-equity (lower is safer), ROE (return on equity, 15%+ is strong), and margins. No single ratio tells the whole story — read them together and within the sector." },
  { lesson_id: "sebi-and-demat", module: "market-basics", topic: "mechanics", level: "beginner",
    content: "In India you trade on NSE/BSE through a SEBI-registered broker using a demat account (holds shares electronically). Costs include brokerage and STT (Securities Transaction Tax). Market hours are 9:15am-3:30pm IST on weekdays." },
  { lesson_id: "paper-trading", module: "stock-simulation", topic: "practice", level: "beginner",
    content: "Finvest's simulator lets you practice buying and selling with virtual money and real prices — zero real-world risk. Use it to learn how orders, P&L, and volatility feel before risking real money." },
  { lesson_id: "position-sizing", module: "stock-simulation", topic: "risk-management", level: "advanced",
    content: "Position sizing limits how much you can lose on one trade. A common rule: risk no more than 1-2% of your capital per trade. Shares to buy ≈ (capital × risk%) ÷ (entry price − stop-loss price)." },
];

const out = [];
for (const c of CHUNKS) {
  const { data, error } = await db.functions.invoke("embed", { body: { text: c.content } });
  if (error || !data?.embedding) { console.error("embed failed for", c.lesson_id, error?.message); process.exit(1); }
  out.push({ ...c, embedding: data.embedding });
  process.stdout.write(".");
}
const { error } = await db.from("lesson_chunks").upsert(out, { onConflict: "id" });
if (error) { console.error("\ninsert failed:", error.message); process.exit(1); }
console.log(`\nseeded ${out.length} chunks across modules: ${[...new Set(CHUNKS.map(c => c.module))].join(", ")}`);
