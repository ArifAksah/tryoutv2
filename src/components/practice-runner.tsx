"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition, useCallback } from "react";
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
  durationMinutes?: number;
  packageNumber?: number;
};

export function PracticeRunner({
  categoryId,
  categorySlug,
  categoryName,
  questions,
  submitAction,
  initialAttemptNumber,
  initialRecentAttempts,
  durationMinutes,
  packageNumber,
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

  // Timer state
  const [timeLeft, setTimeLeft] = useState<number | null>(
    durationMinutes ? durationMinutes * 60 : null
  );

  const [submitState, formAction] = useActionState<SubmitPracticeState, FormData>(submitAction, {
    ok: false,
    error: "",
  });
  const [isPending, startTransition] = useTransition();

  const handleFinish = useCallback(async (autoSubmit = false) => {
    if (isPending) return;

    if (!autoSubmit) {
      const answeredCount = Object.keys(answers).filter((k) => answers[k]).length;
      const doubtAnsweredCount = Object.keys(doubts).filter((id) => Boolean(doubts[id]) && Boolean(answers[id])).length;
      const unansweredCount = questions.length - answeredCount;

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
    }

    const fd = new FormData();
    fd.set("category_id", categoryId);
    fd.set("started_at", startedAt);
    fd.set("question_ids_json", JSON.stringify(questions.map((q) => q.id)));
    fd.set("answers_json", JSON.stringify(answers));
    fd.set("doubts_json", JSON.stringify(doubts));
    if (packageNumber) {
      fd.set("package_number", String(packageNumber));
    }

    void Swal.fire({
      title: autoSubmit ? "Waktu Habis!" : "Menyimpan...",
      text: autoSubmit ? "Latihan otomatis disimpan." : undefined,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    startTransition(() => formAction(fd));
  }, [answers, categoryId, doubts, isPending, packageNumber, questions, startedAt]);

  // Timer effect
  useEffect(() => {
    if (!durationMinutes || submitted || timeLeft === null) return;

    if (timeLeft <= 0) {
      void handleFinish(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [durationMinutes, handleFinish, submitted, timeLeft]);

  // Format time MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!submitState.ok) return;
    setAttemptNumber(submitState.attemptNumber);
    setRecentAttempts(submitState.recentAttempts);
    setSessionId(submitState.sessionId);
    Swal.close();
    setSubmitted(true);
    if (durationMinutes) setTimeLeft(0);
  }, [submitState, durationMinutes]);

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
  // const unansweredCount = questions.length - answeredCount; // Removed unused variable

  if (submitted && results) {
    return (
      <div className="mx-auto min-h-screen max-w-4xl space-y-6 p-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Hasil Latihan: {categoryName}</h1>
              <p className="text-slate-600">
                {packageNumber ? `Paket ${packageNumber} · ` : ""}Review jawaban dan pembahasan · Percobaan ke-<span className="font-semibold">{attemptNumber}</span>
              </p>
            </div>
            {packageNumber && (
              <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800">
                Paket {packageNumber} Selesai
              </span>
            )}
          </div>
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
                  // If we want exact attempt number from DB we'd need to fetch it, 
                  // but here we just decrement from current attemptNumber for display
                  // This visual logic might be slightly off if gaps exist, but acceptable for now.
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
                className={`rounded-lg border p-6 ${detail.isCorrect
                  ? "border-emerald-200 bg-emerald-50"
                  : detail.chosen
                    ? "border-rose-200 bg-rose-50"
                    : "border-slate-200 bg-white"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">Soal #{idx + 1}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${detail.isCorrect
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
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${isCorrect
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
    <div className="mx-auto min-h-screen max-w-4xl pb-24 md:p-6 md:pb-10">
      {/* Sticky Header (Timer & Status) */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 md:rounded-xl md:border md:px-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-sm font-bold text-slate-900 md:text-xl">
              {categoryName}
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {packageNumber ? (
                <span className="font-semibold text-sky-700">Paket {packageNumber}</span>
              ) : (
                <span>Custom</span>
              )}
              <span>·</span>
              <span>Soal {currentIndex + 1} / {questions.length}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {timeLeft !== null && (
              <div
                className={`flex items-center justify-center rounded-lg border px-3 py-1.5 font-mono text-base font-bold md:text-lg ${timeLeft < 60
                  ? "border-rose-200 bg-rose-50 text-rose-600 animate-pulse"
                  : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
              >
                {formatTime(timeLeft)}
              </div>
            )}
            {/* Desktop-only Finish Button */}
            <button
              type="button"
              onClick={() => void handleFinish()}
              className="hidden rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 md:block"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-0 md:mt-6 space-y-6">
        {/* Question Selector (Horizontal Scroll) */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide md:flex-wrap md:overflow-visible md:pb-0">
          {questions.map((q, idx) => {
            const answered = Boolean(answers[q.id]);
            const doubtful = Boolean(doubts[q.id]);
            const active = idx === currentIndex;

            const statusClass = !answered
              ? "border-slate-200 bg-white text-slate-600"
              : doubtful
                ? "border-amber-300 bg-amber-100 text-amber-800"
                : "border-emerald-300 bg-emerald-100 text-emerald-800";

            // Highlight active even if answered
            const activeClass = active ? "ring-2 ring-sky-500 ring-offset-1 border-sky-400 z-10" : "";

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`h-10 w-10 shrink-0 rounded-lg border text-sm font-bold transition-all ${statusClass} ${activeClass}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Question Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Soal #{currentQuestion?.order}</span>
            <span>{currentQuestion?.questionType?.replace("_", " ")}</span>
          </div>

          <div className="mt-4">
            <MathText text={currentQuestion?.questionText || ""} className="text-lg font-medium leading-relaxed text-slate-900 md:text-xl" />
          </div>

          <div className="mt-4">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 transition hover:bg-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                checked={currentDoubt}
                disabled={!currentQuestion}
                onChange={() => {
                  if (!currentQuestion) return;
                  const id = currentQuestion.id;
                  setDoubts((prev) => ({ ...prev, [id]: !Boolean(prev[id]) }));
                }}
              />
              <span className="text-sm font-medium text-slate-700">Tandai Ragu-ragu</span>
            </label>
          </div>

          <div className="mt-6 space-y-3">
            {currentQuestion?.options.map((opt) => {
              const key = opt.key.toUpperCase();
              const isSelected = userAnswer === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: key }))}
                  className={`group relative flex w-full items-start gap-4 rounded-xl border px-4 py-4 text-left transition-all active:scale-[0.99] md:px-5 ${isSelected
                    ? "border-sky-500 bg-sky-50 shadow-sm ring-1 ring-sky-500"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                >
                  <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors ${isSelected ? "border-sky-500 bg-sky-500 text-white" : "border-slate-300 bg-white text-slate-500 group-hover:border-slate-400 group-hover:text-slate-600"}`}>
                    {key}
                  </span>
                  <div className={`flex-1 text-base ${isSelected ? "text-slate-900 font-medium" : "text-slate-700"}`}>
                    <MathText text={opt.text} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Nav (Mobile Only mostly, but feels app-like) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:hidden">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
            disabled={currentIndex === 0}
            className="flex-1 rounded-lg border border-slate-200 bg-white py-3 font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-50"
          >
            ← Prev
          </button>

          {currentIndex === questions.length - 1 ? (
            <button
              type="button"
              onClick={() => void handleFinish()}
              className="flex-[2] rounded-lg bg-emerald-600 py-3 font-bold text-white shadow-sm active:bg-emerald-700 active:scale-[0.98]"
            >
              Selesai & Submit
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentIndex((idx) => Math.min(questions.length - 1, idx + 1))}
              className="flex-[2] rounded-lg bg-sky-600 py-3 font-bold text-white shadow-sm active:bg-sky-700 active:scale-[0.98]"
            >
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Desktop Bottom Nav */}
      <div className="mt-8 hidden flex-col items-center justify-between gap-4 md:flex md:flex-row">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
            disabled={currentIndex === 0}
            className="rounded-lg border border-slate-200 px-6 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            ← Sebelumnya
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex((idx) => Math.min(questions.length - 1, idx + 1))}
            disabled={currentIndex === questions.length - 1}
            className="rounded-lg border border-slate-200 px-6 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Berikutnya →
          </button>
        </div>

        <div className="text-sm font-medium text-slate-500">
          {answeredCount} dijawab · {doubtAnsweredCount} ragu-ragu
        </div>
      </div>
    </div>
  );
}
