"use server";

import { requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type SubmitPracticeState =
  | { ok: false; error: string }
  | {
      ok: true;
      attemptNumber: number;
      sessionId: string;
      scoreTotal: number;
      maxScore: number;
      correctCount: number;
      totalQuestions: number;
      recentAttempts: Array<{
        id: string;
        started_at: string;
        finished_at: string | null;
        score_total: number;
        max_score: number;
        correct_count: number;
        total_questions: number;
      }>;
    };

function getString(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function parseJsonObject(value: string): Record<string, unknown> {
  if (!value) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, unknown>;
}

function parseUuidArray(value: string): string[] {
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
}

export async function submitPracticeAttempt(
  _prev: SubmitPracticeState,
  formData: FormData
): Promise<SubmitPracticeState> {
  const user = await requireUser("/practice");

  const categoryId = getString(formData, "category_id");
  const questionIdsJson = getString(formData, "question_ids_json");
  const answersJson = getString(formData, "answers_json");
  const doubtsJson = getString(formData, "doubts_json");
  const startedAtRaw = getString(formData, "started_at");

  if (!categoryId) return { ok: false, error: "Kategori tidak valid." };

  const questionIds = parseUuidArray(questionIdsJson);
  if (questionIds.length === 0) return { ok: false, error: "Tidak ada soal untuk disimpan." };

  const answersObj = parseJsonObject(answersJson) as Record<string, string>;
  const doubtsObj = parseJsonObject(doubtsJson) as Record<string, boolean>;

  const now = new Date();
  const startedAtParsed = startedAtRaw ? new Date(startedAtRaw) : null;
  const startedAt =
    startedAtParsed && !Number.isNaN(startedAtParsed.getTime())
      ? startedAtParsed
      : now;
  const startedAtSafe = startedAt.getTime() > now.getTime() ? now : startedAt;

  const supabase = await getSupabaseServerClient("write");

  const { data: dbQuestions, error: qErr } = await supabase
    .from("questions")
    .select("id, question_type, answer_key")
    .in("id", questionIds);

  if (qErr) return { ok: false, error: qErr.message };
  const questions = (dbQuestions ?? []) as Array<{
    id: string;
    question_type: "multiple_choice" | "scale_tkp";
    answer_key: unknown;
  }>;

  const questionById = new Map(questions.map((q) => [q.id, q] as const));
  const filteredIds = questionIds.filter((id) => questionById.has(id));
  if (filteredIds.length === 0) return { ok: false, error: "Soal tidak ditemukan di database." };

  let scoreTotal = 0;
  let maxScore = 0;
  let correctCount = 0;

  for (const qId of filteredIds) {
    const q = questionById.get(qId)!;
    const chosen = String(answersObj[qId] ?? "").toUpperCase();
    const answerKey = (q.answer_key ?? {}) as Record<string, unknown>;

    if (q.question_type === "multiple_choice") {
      const correct = String(answerKey.correct ?? "").toUpperCase();
      const perRaw = answerKey.score;
      const per = typeof perRaw === "number" ? perRaw : Math.max(1, parseInt(String(perRaw ?? "1"), 10) || 1);
      maxScore += per;
      if (chosen && chosen === correct) {
        scoreTotal += per;
        correctCount += 1;
      }
      continue;
    }

    // TKP scale
    const numericEntries = Object.entries(answerKey)
      .filter(([, v]) => typeof v === "number")
      .map(([, v]) => v as number);
    const tkpMax = numericEntries.length ? Math.max(...numericEntries) : 0;
    maxScore += tkpMax;

    if (chosen) {
      const raw = answerKey[chosen];
      if (typeof raw === "number") scoreTotal += raw;
    }
  }

  const takeCount = filteredIds.length;
  const finishedAt = now;

  const { data: inserted, error: insErr } = await supabase
    .from("user_practice_sessions")
    .insert({
      user_id: user.id,
      category_id: categoryId,
      take_count: takeCount,
      question_ids: filteredIds,
      answers: answersObj,
      doubts: doubtsObj,
      score_total: scoreTotal,
      max_score: maxScore,
      correct_count: correctCount,
      total_questions: takeCount,
      started_at: startedAtSafe.toISOString(),
      finished_at: finishedAt.toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (insErr || !inserted?.id) return { ok: false, error: insErr?.message || "Gagal menyimpan history latihan." };

  const { count } = await supabase
    .from("user_practice_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("category_id", categoryId);

  const attemptNumber = count ?? 1;

  const { data: recent } = await supabase
    .from("user_practice_sessions")
    .select("id, started_at, finished_at, score_total, max_score, correct_count, total_questions")
    .eq("user_id", user.id)
    .eq("category_id", categoryId)
    .order("started_at", { ascending: false })
    .limit(10);

  return {
    ok: true,
    attemptNumber,
    sessionId: inserted.id,
    scoreTotal,
    maxScore,
    correctCount,
    totalQuestions: takeCount,
    recentAttempts: (recent ?? []) as Array<{
      id: string;
      started_at: string;
      finished_at: string | null;
      score_total: number;
      max_score: number;
      correct_count: number;
      total_questions: number;
    }>,
  };
}
