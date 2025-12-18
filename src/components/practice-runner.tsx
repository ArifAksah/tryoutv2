"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { MathText } from "./math-text";
import type { SubmitPracticeState } from "@/app/practice/actions";
import Swal from "sweetalert2";

type Choice = {
  key: string;
  text: string;
};

type PracticeQuestion = {
  id: string;
  questionText: string;
  questionType: "multiple_choice" | "scale_tkp";
  options: Choice[];
  answerKey: Record<string, string | number>;
  discussion: string | null;
  order: number;
};

type Props = {
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  questions: PracticeQuestion[];
  submitAction: (prev: SubmitPracticeState, formData: FormData) => Promise<SubmitPracticeState>;
  initialAttemptNumber?: number;
  initialRecentAttempts?: Array<{
    id: string;
    started_at: string;
    finished_at: string | null;
    score_total: number;
    max_score: number;
    correct_count: number;
    total_questions: number;
  }>;
};

export function PracticeRunner({
  categoryId,
  categorySlug,
  categoryName,
  questions,
  submitAction,
  initialAttemptNumber,
  initialRecentAttempts,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [doubts, setDoubts] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [attemptNumber, setAttemptNumber] = useState<number>(initialAttemptNumber ?? 1);
  const [recentAttempts, setRecentAttempts] = useState<Props["initialRecentAttempts"]>(initialRecentAttempts ?? []);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt] = useState(() => new Date().toISOString());
  const lastErrorRef = useRef<string>("");

  const [submitState, formAction] = useActionState<SubmitPracticeState, FormData>(submitAction, {
    ok: false,
    error: "",
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!submitState.ok) return;
    setAttemptNumber(submitState.attemptNumber);
    setRecentAttempts(submitState.recentAttempts);
    setSessionId(submitState.sessionId);
    Swal.close();
    setSubmitted(true);
  }, [submitState]);

  useEffect(() => {
    if (submitState.ok) {
      lastErrorRef.current = "";
      return;
    }
    if (!submitState.error) return;
    if (submitState.error === lastErrorRef.current) return;
    lastErrorRef.current = submitState.error;
    Swal.close();
    void Swal.fire({
      icon: "error",
      title: "Gagal",
      text: submitState.error,
    });
  }, [submitState]);

  const currentQuestion = questions[currentIndex];
  const userAnswer = answers[currentQuestion?.id];
  const currentDoubt = Boolean(currentQuestion?.id && doubts[currentQuestion.id]);

  const results = useMemo(() => {
    if (!submitted) return null;

    let correctCount = 0;
    let totalScore = 0;
    let maxScore = 0;

    const details = questions.map((q) => {
      const chosen = answers[q.id]?.toUpperCase();
      let isCorrect = false;
      let scoreObtained = 0;
      let correctAnswer = "";
      let maxPossible = 0;

      if (q.questionType === "multiple_choice") {
        const correctValue = q.answerKey?.correct;
        correctAnswer = typeof correctValue === "string" ? correctValue.toUpperCase() : String(correctValue || "").toUpperCase();
        isCorrect = chosen === correctAnswer;
        const scoreValue = q.answerKey?.score;
        maxPossible = typeof scoreValue === "number" ? scoreValue : parseInt(String(scoreValue || "1"), 10);
        scoreObtained = isCorrect ? maxPossible : 0;
        if (isCorrect) correctCount++;
      } else if (q.questionType === "scale_tkp") {
        const scoreMap = q.answerKey || {};
        const chosenScore = chosen ? scoreMap[chosen] : 0;
        scoreObtained = typeof chosenScore === "number" ? chosenScore : parseInt(String(chosenScore || "0"), 10);
        maxPossible = Math.max(...Object.values(scoreMap).map((v) => typeof v === "number" ? v : parseInt(String(v), 10)));
      }

      totalScore += scoreObtained;
      maxScore += maxPossible;

      return {
        question: q,
        chosen,
        isCorrect,
        correctAnswer,
        scoreObtained,
        maxPossible,
      };
    });

    return { correctCount, totalScore, maxScore, details };
  }, [submitted, answers, questions]);

  const answeredCount = Object.keys(answers).filter((k) => answers[k]).length;
  const doubtAnsweredCount = Object.keys(doubts).filter((id) => Boolean(doubts[id]) && Boolean(answers[id])).length;
  const unansweredCount = questions.length - answeredCount;

  const handleFinish = async () => {
    if (isPending) return;
    const html =
      unansweredCount > 0 || doubtAnsweredCount > 0
        ? `Anda masih memiliki <b style="color:#b45309">${unansweredCount} soal</b> yang belum dikerjakan` +
          (doubtAnsweredCount > 0
            ? ` dan <b style="color:#b45309">${doubtAnsweredCount} soal</b> yang ditandai ragu-ragu.`
            : ".") +
          `<br/><br/>Apakah Anda yakin ingin menyelesaikan latihan dan melihat hasil?`
        : "Apakah Anda yakin ingin menyelesaikan latihan dan melihat hasil?";

    const res = await Swal.fire({
      title: "Selesaikan Latihan?",
      html,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Selesaikan",
      cancelButtonText: "Batal",
      reverseButtons: true,
    });

    if (!res.isConfirmed) return;

    const fd = new FormData();
    fd.set("category_id", categoryId);
    fd.set("started_at", startedAt);
    fd.set("question_ids_json", JSON.stringify(questions.map((q) => q.id)));
    fd.set("answers_json", JSON.stringify(answers));
    fd.set("doubts_json", JSON.stringify(doubts));

    void Swal.fire({
      title: "Menyimpan...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    startTransition(() => formAction(fd));
  };

  if (submitted && results) {
    return (
      <div className="mx-auto min-h-screen max-w-4xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Hasil Latihan: {categoryName}</h1>
          <p className="text-slate-600">
            Review jawaban dan pembahasan · Percobaan ke-<span className="font-semibold">{attemptNumber}</span>
          </p>
        </div>

        {recentAttempts && recentAttempts.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Riwayat Pengerjaan (10 terakhir)</p>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[120px_1fr_120px_120px] gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                <div>Percobaan</div>
                <div>Waktu</div>
                <div className="text-right">Benar</div>
                <div className="text-right">Skor</div>
              </div>
              <div className="divide-y divide-slate-200">
                {recentAttempts.map((s, idx) => {
                  const num = attemptNumber - idx;
                  const startLabel = s.started_at ? new Date(s.started_at).toLocaleString("id-ID") : "-";
                  const finishLabel = s.finished_at ? new Date(s.finished_at).toLocaleString("id-ID") : "-";
                  return (
                    <div key={s.id} className="grid grid-cols-[120px_1fr_120px_120px] gap-3 px-4 py-2 text-sm">
                      <div className="font-semibold text-slate-900">#{num}</div>
                      <div className="text-xs text-slate-600">
                        <div>Mulai: {startLabel}</div>
                        <div>Selesai: {finishLabel}</div>
                      </div>
                      <div className="text-right text-sm font-semibold text-slate-900">
                        {s.correct_count}/{s.total_questions}
                      </div>
                      <div className="text-right text-sm font-semibold text-slate-900">
                        {s.score_total}/{s.max_score}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="text-sm text-slate-600">Total Skor</div>
            <div className="text-3xl font-bold text-slate-900">
              {results.totalScore}/{results.maxScore}
            </div>
            <div className="text-sm text-slate-600">
              {results.maxScore > 0 ? Math.round((results.totalScore / results.maxScore) * 100) : 0}%
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
            <div className="text-sm text-emerald-700">Benar (MC)</div>
            <div className="text-3xl font-bold text-emerald-900">{results.correctCount}</div>
            <div className="text-sm text-emerald-700">dari {questions.length} soal</div>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-6">
            <div className="text-sm text-sky-700">Dijawab</div>
            <div className="text-3xl font-bold text-sky-900">{answeredCount}</div>
            <div className="text-sm text-sky-700">dari {questions.length} soal</div>
          </div>
        </div>

        <div className="space-y-4">
          {results.details.map((detail, idx) => {
            const q = detail.question;
            return (
              <div
                key={q.id}
                className={`rounded-lg border p-6 ${
                  detail.isCorrect
                    ? "border-emerald-200 bg-emerald-50"
                    : detail.chosen
                      ? "border-rose-200 bg-rose-50"
                      : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">Soal #{idx + 1}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      detail.isCorrect
                        ? "bg-emerald-100 text-emerald-700"
                        : detail.chosen
                          ? "bg-rose-100 text-rose-700"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {detail.isCorrect ? "✓ Benar" : detail.chosen ? "✗ Salah" : "Tidak dijawab"}
                  </span>
                </div>

                <MathText text={q.questionText} className="mt-3 text-base font-semibold text-slate-900" />

                <div className="mt-3 space-y-2">
                  {q.options.map((opt) => {
                    const key = opt.key.toUpperCase();
                    const isChosen = detail.chosen === key;
                    const isCorrect = detail.correctAnswer === key;

                    return (
                      <div
                        key={key}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${
                          isCorrect
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
                          {isCorrect && (
                            <span className="ml-2 text-xs font-semibold text-emerald-700">
                              ✓ Jawaban Benar
                            </span>
                          )}
                          {isChosen && !isCorrect && (
                            <span className="ml-2 text-xs font-semibold text-rose-700">
                              Jawaban Anda
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {q.discussion && (
                  <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                      Pembahasan
                    </p>
                    <MathText text={q.discussion} className="mt-2 text-sm text-sky-900" />
                  </div>
                )}

                <div className="mt-3 text-sm text-slate-600">
                  Skor: {detail.scoreObtained}/{detail.maxPossible}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Link
            href="/"
            className="rounded-lg border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Kembali ke Dashboard
          </Link>
          {sessionId ? (
            <Link
              href={`/practice/${categorySlug}/history/${sessionId}`}
              className="rounded-lg border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Review percobaan ini
            </Link>
          ) : null}
          <Link
            href={`/practice/${categorySlug}/history`}
            className="rounded-lg border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Semua riwayat
          </Link>
          <Link
            href={`/leaderboard/practice/${encodeURIComponent(categorySlug)}`}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-3 font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            Leaderboard topik
          </Link>
          <Link
            href="/practice/history"
            className="rounded-lg border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Semua latihan (global)
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-sky-600 px-6 py-3 font-semibold text-white hover:bg-sky-700"
          >
            Latihan Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl space-y-6 p-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Latihan: {categoryName}</h1>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
            {currentIndex + 1}/{questions.length}
          </span>
        </div>
        <p className="text-slate-600">Mode latihan tanpa timer. Kerjakan dengan santai!</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {questions.map((q, idx) => {
          const answered = Boolean(answers[q.id]);
          const doubtful = Boolean(doubts[q.id]);
          const active = idx === currentIndex;

          const statusClass = !answered
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : doubtful
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-700";

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`h-10 w-10 rounded-md border text-sm font-semibold transition ${
                statusClass
              } ${active ? "ring-2 ring-sky-300 ring-offset-1" : "hover:bg-slate-50"}
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Soal #{currentQuestion?.order}</span>
          <span>Tipe: {currentQuestion?.questionType}</span>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={currentDoubt}
            disabled={!currentQuestion}
            onChange={() => {
              if (!currentQuestion) return;
              const id = currentQuestion.id;
              setDoubts((prev) => ({ ...prev, [id]: !Boolean(prev[id]) }));
            }}
          />
          <span>Ragu-ragu</span>
        </label>

        <MathText text={currentQuestion?.questionText || ""} className="mt-4 text-lg font-semibold text-slate-900" />

        <div className="mt-4 space-y-3">
          {currentQuestion?.options.map((opt) => {
            const key = opt.key.toUpperCase();
            const isSelected = userAnswer === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: key }))}
                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${
                  isSelected
                    ? "border-sky-300 bg-sky-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold">
                  {key}
                </span>
                <MathText text={opt.text} className="text-slate-900" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
            className="rounded-lg border border-slate-200 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
            disabled={currentIndex === 0}
          >
            ← Sebelumnya
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex((idx) => Math.min(questions.length - 1, idx + 1))}
            className="rounded-lg border border-slate-200 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
            disabled={currentIndex === questions.length - 1}
          >
            Berikutnya →
          </button>
        </div>

        <button
          type="button"
          onClick={() => void handleFinish()}
          className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700"
        >
          Lihat Hasil & Pembahasan
        </button>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
        <span className="font-semibold text-amber-900">💡 Tips:</span>
        <span className="ml-2 text-amber-800">
          Dijawab: {answeredCount}/{questions.length} · Belum dijawab: {questions.length - answeredCount} · Ragu-ragu: {doubtAnsweredCount}
        </span>
      </div>
    </div>
  );
}
