import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { retrieve } from "@/lib/rag";
import { buildSystemBlocks } from "@/lib/system-prompt";
import type { RetrievedChunk } from "@/lib/types";

const ROWS = [
  { lesson_id: "l1", module: "market-basics", topic: "pe-ratio", level: "beginner", content: "P/E is the share price divided by earnings per share.", similarity: 0.91 },
  { lesson_id: "l2", module: "market-basics", topic: "diversification", level: "all", content: "Diversification spreads risk across sectors.", similarity: 0.82 },
];

function fakeDb(opts: { embedErr?: boolean; rpcErr?: boolean; rows?: typeof ROWS } = {}): SupabaseClient {
  return {
    functions: {
      invoke: async () =>
        opts.embedErr
          ? { data: null, error: { message: "embed failed" } }
          : { data: { embedding: new Array(384).fill(0.1) }, error: null },
    },
    rpc: async () =>
      opts.rpcErr ? { data: null, error: { message: "rpc failed" } } : { data: opts.rows ?? ROWS, error: null },
  } as unknown as SupabaseClient;
}

describe("RAG retrieval", () => {
  it("returns [] on the empty-retrieval path (Supabase unconfigured)", async () => {
    expect(await retrieve("what is a P/E ratio", { db: null })).toEqual([]);
  });

  it("returns [] for an empty query", async () => {
    expect(await retrieve("   ", { db: fakeDb() })).toEqual([]);
  });

  it("maps matched chunks from pgvector", async () => {
    const out = await retrieve("explain P/E", { db: fakeDb() });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject<Partial<RetrievedChunk>>({
      lessonId: "l1",
      module: "market-basics",
      topic: "pe-ratio",
      text: "P/E is the share price divided by earnings per share.",
      score: 0.91,
    });
  });

  it("falls back to [] when embedding or rpc fails", async () => {
    expect(await retrieve("q", { db: fakeDb({ embedErr: true }) })).toEqual([]);
    expect(await retrieve("q", { db: fakeDb({ rpcErr: true }) })).toEqual([]);
  });
});

describe("system prompt prefers retrieved content", () => {
  it("injects retrieved chunks and tells the model to prefer them", () => {
    const chunk: RetrievedChunk = { lessonId: "l1", module: "market-basics", topic: "pe-ratio", level: "beginner", text: "P/E is price over earnings.", score: 0.9 };
    const blocks = buildSystemBlocks({ retrieved: [chunk], learner: { level: "beginner" } });
    expect(blocks[1].text).toContain("P/E is price over earnings.");
    expect(blocks[1].text.toLowerCase()).toContain("prefer this");
  });

  it("flags first-principles fallback when retrieval is empty", () => {
    const blocks = buildSystemBlocks({ retrieved: [], learner: { level: "beginner" } });
    expect(blocks[1].text.toLowerCase()).toContain("first principles");
  });
});
