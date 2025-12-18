"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { SubmitTryoutState } from "@/app/tryout/real/actions";
import { MathText } from "./math-text";
import Swal from "sweetalert2";

type Choice = {
  key: string;
  text: string;
};

type RealQuestion = {
  id: string;
  topicSlug: string;
  questionText: string;
  questionType: "multiple_choice" | "scale_tkp";
  options: Choice[];
};

type Props = {
  sessionId: string;
  startedAt: string;
  durationMinutes: number;
  questions: RealQuestion[];
  submitAction: (prev: SubmitTryoutState, formData: FormData) => Promise<SubmitTryoutState>;
};

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function RealTryoutRunner({ sessionId, startedAt, durationMinutes, questions, submitAction }: Props) {
  const [state, formAction, pending] = useActionState<SubmitTryoutState, FormData>(submitAction, {
    ok: false,
    error: "",
  });
  const [isPending, startTransition] = useTransition();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [doubts, setDoubts] = useState<Record<string, boolean>>({});
  const [remaining, setRemaining] = useState<number>(() => durationMinutes * 60);
  const submitted = state.ok;
  const isSubmitting = pending || isPending;
  const lastErrorRef = useRef<string>("");

  const endAtMs = useMemo(() => {
    const startMs = new Date(startedAt).getTime();
    return startMs + durationMinutes * 60 * 1000;
  }, [startedAt, durationMinutes]);

  useEffect(() => {
    const tick = () => {
      const delta = Math.floor((endAtMs - Date.now()) / 1000);
      setRemaining(delta);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endAtMs]);

  const unansweredCount = useMemo(() => {
    const ids = new Set(Object.keys(answers).filter((k) => answers[k]));
    return questions.filter((q) => !ids.has(q.id)).length;
  }, [answers, questions]);

  const doubtAnsweredCount = useMemo(() => {
    return questions.filter((q) => Boolean(answers[q.id]) && Boolean(doubts[q.id])).length;
  }, [answers, doubts, questions]);

  const currentQuestion = questions[currentIndex];
  const currentDoubt = Boolean(currentQuestion?.id && doubts[currentQuestion.id]);

  const doSubmit = () => {
    if (isSubmitting || submitted) return;
    const fd = new FormData();
    fd.set("session_id", sessionId);
    fd.set("answers_json", JSON.stringify(answers));
    startTransition(() => {
      formAction(fd);
    });
  };

  const confirmSubmit = async () => {
    if (isSubmitting || submitted) return;

    const html =
      unansweredCount > 0 || doubtAnsweredCount > 0
        ? `Sebelum submit, cek dulu status berikut:<br/><br/>
           <b style="color:#be123c">${unansweredCount} belum dijawab</b> · <b style="color:#b45309">${doubtAnsweredCount} ragu-ragu</b><br/><br/>
           Apakah Anda yakin ingin submit sekarang?`
        : "Semua soal sudah dijawab tanpa ragu. Apakah Anda yakin ingin submit sekarang?";

    const res = await Swal.fire({
      title: "Submit Tryout?",
      html,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Submit",
      cancelButtonText: "Batal",
      reverseButtons: true,
    });

    if (res.isConfirmed) doSubmit();
  };

  useEffect(() => {
    if (state.ok) {
      lastErrorRef.current = "";
      return;
    }
    if (!state.error) return;
    if (state.error === lastErrorRef.current) return;
    lastErrorRef.current = state.error;
    void Swal.fire({
      icon: "error",
      title: "Gagal",
      text: state.error,
    });
  }, [state]);

  useEffect(() => {
    if (remaining <= 0 && !isSubmitting && !submitted && questions.length > 0) {
      doSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, isSubmitting, submitted, questions.length]);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      {state.ok ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-semibold text-emerald-900">
            Skor: {state.scoreTotal} / {state.maxScore} ({
              state.maxScore === 0 ? 0 : Math.round((state.scoreTotal / state.maxScore) * 100)
            }%)
          </p>
          <p className="mt-1 text-xs text-emerald-900">
            Status: {state.status} · Benar (MC): {state.correctCount} · Total soal: {state.totalQuestions}
          </p>
          <div className="mt-2">
            <Link
              href={`/tryout/history/${encodeURIComponent(sessionId)}`}
              className="inline-flex rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Review detail jawaban
            </Link>
          </div>
        </div>
      ) : state.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tryout Real</p>
          <p className="text-sm text-slate-700">
            Timer berjalan. Submit otomatis saat waktu habis.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
            Waktu: <span className={remaining <= 60 ? "font-semibold text-rose-700" : "font-semibold"}>{formatTime(remaining)}</span>
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
            Soal: {currentIndex + 1}/{questions.length}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
            Belum dijawab: {unansweredCount}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
            Ragu-ragu: {doubtAnsweredCount}
          </span>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Belum ada soal untuk tryout ini.
        </div>
      ) : (
        <>
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
                  className={`h-9 w-9 rounded-md border text-xs font-semibold transition ${
                    statusClass
                  } ${
                    active ? "ring-2 ring-sky-300 ring-offset-1" : "hover:bg-slate-50"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Topik: {currentQuestion?.topicSlug}</span>
              <span>Tipe: {currentQuestion?.questionType}</span>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={currentDoubt}
                disabled={!currentQuestion || isSubmitting || submitted}
                onChange={() => {
                  if (!currentQuestion) return;
                  const id = currentQuestion.id;
                  setDoubts((prev) => ({ ...prev, [id]: !Boolean(prev[id]) }));
                }}
              />
              <span>Ragu-ragu</span>
            </label>

            <MathText text={currentQuestion?.questionText || ""} className="mt-3 text-base font-semibold text-slate-900" />

            <div className="mt-3 space-y-2">
              {currentQuestion?.options.map((opt) => {
                const key = opt.key.toUpperCase();
                const isSelected = answers[currentQuestion.id] === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isSubmitting || submitted}
                    onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: key }))}
                    className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? "border-sky-300 bg-sky-50 text-slate-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700">
                      {key}
                    </span>
                    <MathText text={opt.text} className="text-slate-900" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              disabled={currentIndex === 0}
            >
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => setCurrentIndex((idx) => Math.min(questions.length - 1, idx + 1))}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              disabled={currentIndex === questions.length - 1}
            >
              Berikutnya
            </button>

            <button
              type="button"
              onClick={() => void confirmSubmit()}
              className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              disabled={isSubmitting || submitted}
            >
              {isSubmitting ? "Mengirim..." : submitted ? "Sudah submit" : "Submit"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
