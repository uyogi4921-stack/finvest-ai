import { NextRequest, NextResponse } from "next/server";
import { runTutorTurn } from "@/lib/pipeline";
import { retrieve } from "@/lib/rag";
import type { ChatMessage, LearnerState } from "@/lib/types";

export const runtime = "nodejs";

interface ChatBody {
  userText: string;
  history?: ChatMessage[];
  learner?: LearnerState;
  userId?: string;
}

const DEFAULT_LEARNER: LearnerState = { level: "beginner" };

export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.userText || typeof body.userText !== "string") {
    return NextResponse.json({ error: "userText required" }, { status: 400 });
  }

  try {
    const learner = body.learner ?? DEFAULT_LEARNER;
    // RAG: retrieve curated lesson chunks for this query (empty → first-principles).
    const retrieved = await retrieve(body.userText, { level: learner.level });
    const result = await runTutorTurn({
      userText: body.userText,
      history: body.history,
      context: { retrieved, learner },
      deps: { toolCtx: { userId: body.userId } },
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
