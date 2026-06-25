import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RetrievedChunk } from "./types";

/**
 * RAG over curated lesson content in Supabase pgvector.
 *
 * On each turn: embed the query (gte-small via the `embed` Edge Function),
 * match top-k chunks, and return them to be injected into the system prompt.
 * Content lives in an editable table (`lesson_chunks`) — the team corrects
 * curriculum there, never in the baked prompt.
 *
 * If Supabase isn't configured or retrieval fails, we return [] and the model
 * falls back to first principles (flagged in the system prompt).
 */

let _sb: SupabaseClient | null = null;
function serverClient(): SupabaseClient | null {
  if (_sb) return _sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}

export interface RetrieveOpts {
  module?: string; // routing namespace (Step 4)
  level?: string; // beginner | intermediate | advanced
  k?: number;
  db?: SupabaseClient | null; // injectable for tests
}

export async function embedQuery(text: string, db: SupabaseClient): Promise<number[] | null> {
  const { data, error } = await db.functions.invoke("embed", { body: { text } });
  if (error || !data?.embedding || !Array.isArray(data.embedding)) return null;
  return data.embedding as number[];
}

export async function retrieve(query: string, opts: RetrieveOpts = {}): Promise<RetrievedChunk[]> {
  const db = opts.db !== undefined ? opts.db : serverClient();
  if (!db || !query.trim()) return []; // empty-retrieval path → first-principles fallback

  try {
    const embedding = await embedQuery(query, db);
    if (!embedding) return [];
    const { data, error } = await db.rpc("match_lesson_chunks", {
      query_embedding: embedding,
      match_count: opts.k ?? 5,
      filter_module: opts.module ?? null,
      filter_level: opts.level ?? null,
    });
    if (error || !Array.isArray(data)) return [];
    return data.map((r: any) => ({
      lessonId: r.lesson_id,
      module: r.module,
      topic: r.topic,
      level: r.level,
      text: r.content,
      score: typeof r.similarity === "number" ? r.similarity : 0,
    }));
  } catch {
    return [];
  }
}
