import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { MathText } from "@/components/math-text";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; sessionId: string }>;
};

type DbQuestion = {
  id: string;
  question_text: string;
  question_type: "multiple_choice" | "scale_tkp";
  options: unknown;
  answer_key: unknown;
  discussion: string | null;
};

export default async function PracticeHistoryDetailPage({ params }: Props) {
  const { slug, sessionId } = await params;
  const user = await requireUser(`/practice/${slug}/history/${sessionId}`);

  const supabase = await getSupabaseServerClient("read");

  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!category) redirect("/");

  const { data: session } = await supabase
    .from("user_practice_sessions")
    .select(
      "id, user_id, category_id, take_count, question_ids, answers, doubts, score_total, max_score, correct_count, total_questions, started_at, finished_at"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) redirect(`/practice/${slug}/history`);
  if (session.user_id !== user.id) redirect(`/practice/${slug}/history`);
  if (session.category_id !== category.id) redirect(`/practice/${slug}/history`);

  const questionIds = (session.question_ids ?? []) as string[];
  const answers = (session.answers ?? {}) as Record<string, string>;
  const doubts = (session.doubts ?? {}) as Record<string, boolean>;

  const { data: qRows } = await supabase
    .from("questions")
    .select("id, question_text, question_type, options, answer_key, discussion")
    .in("id", questionIds);

  const questionById = new Map(((qRows ?? []) as DbQuestion[]).map((q) => [q.id, q] as const));
  const orderedQuestions = questionIds.map((id) => questionById.get(id)).filter(Boolean) as DbQuestion[];

  const answeredCount = orderedQuestions.filter((q) => Boolean(answers[q.id])).length;
  const doubtAnsweredCount = orderedQuestions.filter((q) => Boolean(answers[q.id]) && Boolean(doubts[q.id])).length;
  const unansweredCount = orderedQuestions.length - answeredCount;

  const mcWrongCount = orderedQuestions.filter((q) => {
    if (q.question_type !== "multiple_choice") return false;
    const chosen = String(answers[q.id] ?? "").toUpperCase();
    if (!chosen) return false;
    const key = (q.answer_key ?? {}) as Record<string, unknown>;
    const correct = String(key.correct ?? "").toUpperCase();
    return Boolean(correct) && chosen !== correct;
  }).length;

  const { count: attemptNumberRaw } = await supabase
    .from("user_practice_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("category_id", category.id)
    .lte("started_at", session.started_at);

  const attemptNumber = attemptNumberRaw ?? null;

  const startLabel = session.started_at ? new Date(session.started_at).toLocaleString("id-ID") : "-";
  const finishLabel = session.finished_at ? new Date(session.finished_at).toLocaleString("id-ID") : "-";

  return (
    <div className="mx-auto min-h-screen max-w-4xl space-y-6 p-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href={`/practice/${slug}/history`}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              ← Kembali ke Riwayat
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Review Latihan: {category.name}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {attemptNumber ? (
                <>
                  Percobaan ke-<span className="font-semibold text-slate-900">{attemptNumber}</span> ·{" "}
                </>
              ) : null}
              Mulai: <span className="font-semibold text-slate-900">{startLabel}</span> · Selesai:{" "}
              <span className="font-semibold text-slate-900">{finishLabel}</span>
            </p>
          </div>

          <Link
            href={`/practice/${slug}`}
            className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Latihan Lagi
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-600">Skor</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {session.score_total}/{session.max_score}
          </div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-xs text-emerald-700">Benar (MC)</div>
          <div className="mt-1 text-2xl font-bold text-emerald-900">{session.correct_count}</div>
          <div className="text-xs font-semibold text-emerald-800">Salah (MC): {mcWrongCount}</div>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-5">
          <div className="text-xs text-sky-700">Dijawab</div>
          <div className="mt-1 text-2xl font-bold text-sky-900">{answeredCount}</div>
          <div className="text-xs text-sky-700">dari {orderedQuestions.length}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="text-xs text-amber-800">Perlu dicek</div>
          <div className="mt-1 text-sm font-semibold text-amber-900">
            {unansweredCount} belum dijawab · {doubtAnsweredCount} ragu-ragu
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {orderedQuestions.map((q, idx) => {
          const chosen = String(answers[q.id] ?? "").toUpperCase();
          const isDoubt = Boolean(doubts[q.id]);
          const answerKey = (q.answer_key ?? {}) as Record<string, unknown>;

          let isCorrect = false;
          let scoreObtained = 0;
          let maxPossible = 0;
          let correctAnswer = "";

          if (q.question_type === "multiple_choice") {
            const correct = String(answerKey.correct ?? "").toUpperCase();
            const perRaw = answerKey.score;
            const per = typeof perRaw === "number" ? perRaw : parseInt(String(perRaw ?? "1"), 10) || 1;
            correctAnswer = correct;
            maxPossible = per;
            isCorrect = Boolean(chosen) && chosen === correct;
            scoreObtained = isCorrect ? per : 0;
          } else {
            const numericEntries = Object.entries(answerKey)
              .filter(([, v]) => typeof v === "number")
              .map(([, v]) => v as number);
            maxPossible = numericEntries.length ? Math.max(...numericEntries) : 0;
            const raw = chosen ? answerKey[chosen] : 0;
            scoreObtained = typeof raw === "number" ? raw : parseInt(String(raw ?? "0"), 10) || 0;
          }

          const cardClass = isCorrect
            ? "border-emerald-200 bg-emerald-50"
            : chosen
              ? "border-rose-200 bg-rose-50"
              : "border-slate-200 bg-white";

          const options = Array.isArray(q.options)
            ? (q.options as unknown[]).map((opt) => ({
                key: typeof opt === "string" ? opt : (opt as { key?: string }).key || "",
                text:
                  typeof opt === "string"
                    ? opt
                    : (opt as { text?: string; value?: string }).text ||
                      (opt as { text?: string; value?: string }).value ||
                      "",
              }))
            : [];

          return (
            <div key={q.id} className={`rounded-lg border p-6 ${cardClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">Soal #{idx + 1}</span>
                  {isDoubt ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      Ragu-ragu
                    </span>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    isCorrect
                      ? "bg-emerald-100 text-emerald-700"
                      : chosen
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {isCorrect ? "✓ Benar" : chosen ? "✗ Salah" : "Tidak dijawab"}
                </span>
              </div>

              <MathText text={q.question_text} className="mt-3 text-base font-semibold text-slate-900" />

              {options.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {options.map((opt) => {
                    const key = opt.key.toUpperCase();
                    const isChosen = chosen === key;
                    const isCorrectOpt = q.question_type === "multiple_choice" && correctAnswer === key;

                    return (
                      <div
                        key={key}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${
                          isCorrectOpt
                            ? "border-emerald-300 bg-emerald-100"
                            : isChosen
                              ? "border-rose-300 bg-rose-100"
                              : "border-slate-200 bg-white"
                        }`}
                      >
                        <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-semibold">
                          {key}
                        </span>
                        <div className="flex-1">
                          <MathText text={opt.text} className="text-slate-900" />
                          {isCorrectOpt ? (
                            <span className="ml-2 text-xs font-semibold text-emerald-700">✓ Jawaban Benar</span>
                          ) : null}
                          {isChosen && !isCorrectOpt ? (
                            <span className="ml-2 text-xs font-semibold text-rose-700">Jawaban Anda</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {q.discussion ? (
                <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Pembahasan</p>
                  <MathText text={q.discussion} className="mt-2 text-sm text-sky-900" />
                </div>
              ) : null}

              <div className="mt-3 text-sm text-slate-600">
                Skor: {scoreObtained}/{maxPossible}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
