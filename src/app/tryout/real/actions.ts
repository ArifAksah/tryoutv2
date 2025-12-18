"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export type SubmitTryoutState =
  | { ok: false; error: string }
  | {
      ok: true;
      scoreTotal: number;
      maxScore: number;
      totalQuestions: number;
      correctCount: number;
      status: string;
    };

function getString(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function submitRealTryout(
  _prevState: SubmitTryoutState,
  formData: FormData
): Promise<SubmitTryoutState> {
  await requireUser("/tryout/real");

  const sessionId = getString(formData, "session_id");
  const answersJson = getString(formData, "answers_json");

  if (!sessionId) return { ok: false, error: "Session ID tidak valid." };

  let answers: Record<string, string> = {};
  if (answersJson) {
    try {
      const parsed = JSON.parse(answersJson) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        answers = parsed as Record<string, string>;
      }
    } catch {
      return { ok: false, error: "Format jawaban tidak valid." };
    }
  }

  const supabase = await getSupabaseServerClient("write");
  const { data, error } = await supabase.rpc("submit_tryout_session", {
    p_session_id: sessionId,
    p_answers: answers,
  });

  if (error || !data?.length) {
    return { ok: false, error: error?.message || "Gagal submit tryout." };
  }

  const row = data[0] as {
    score_total: number;
    max_score: number;
    total_questions: number;
    correct_count: number;
    status: string;
  };

  return {
    ok: true,
    scoreTotal: row.score_total,
    maxScore: row.max_score,
    totalQuestions: row.total_questions,
    correctCount: row.correct_count,
    status: row.status,
  };
}
