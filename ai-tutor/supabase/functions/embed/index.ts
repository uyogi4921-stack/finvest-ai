// Supabase Edge Function: embed text with gte-small (384-dim) — runs in-stack,
// no paid embeddings API. Deploy: `supabase functions deploy embed`.
// Invoked from lib/rag.ts via supabase.functions.invoke("embed", { body: { text } }).

// @ts-nocheck — Deno runtime types differ from the Next app's TS config.
const model = new Supabase.ai.Session("gte-small");

Deno.serve(async (req: Request) => {
  try {
    const { text } = await req.json();
    if (typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "text required" }), { status: 400 });
    }
    // mean_pool + normalize → cosine-ready 384-dim vector
    const embedding = await model.run(text, { mean_pool: true, normalize: true });
    return new Response(JSON.stringify({ embedding }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 500 });
  }
});
