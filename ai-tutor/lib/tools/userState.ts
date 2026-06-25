import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LearnerState } from "../types";

/**
 * user_state() — the learner's progress/goals/risk from Supabase. Used to
 * personalise TEACHING only (level, examples, what to review) — never a
 * recommendation. Falls back to a safe default when Supabase isn't configured.
 */

let _sb: SupabaseClient | null = null;
function client(): SupabaseClient | null {
  if (_sb) return _sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}

export interface UserStateResult {
  ok: boolean;
  state: LearnerState;
  source: "supabase" | "default";
  error?: string;
}

const DEFAULT_STATE: LearnerState = { level: "beginner" };

export async function userState(
  userId: string | undefined,
  deps: { db?: SupabaseClient | null } = {},
): Promise<UserStateResult> {
  const db = deps.db !== undefined ? deps.db : client();
  if (!db || !userId) {
    return { ok: true, state: DEFAULT_STATE, source: "default" };
  }
  try {
    const { data, error } = await db
      .from("learner_state")
      .select("name, level, goals, risk_tolerance, current_lesson_id, lessons_completed, recent_quiz_score_pct")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { ok: false, state: DEFAULT_STATE, source: "default", error: error.message };
    if (!data) return { ok: true, state: DEFAULT_STATE, source: "default" };
    return {
      ok: true,
      source: "supabase",
      state: {
        name: data.name ?? undefined,
        level: (data.level ?? "beginner") as LearnerState["level"],
        goals: data.goals ?? undefined,
        riskTolerance: data.risk_tolerance ?? undefined,
        currentLessonId: data.current_lesson_id ?? undefined,
        lessonsCompleted: data.lessons_completed ?? undefined,
        recentQuizScorePct: data.recent_quiz_score_pct ?? undefined,
      },
    };
  } catch (e) {
    return { ok: false, state: DEFAULT_STATE, source: "default", error: e instanceof Error ? e.message : "db error" };
  }
}
