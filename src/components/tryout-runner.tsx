"use client";

import { useMemo, useState } from "react";
import type { Question } from "@/lib/questions";
import type { Topic } from "@/lib/exam-structure";
import { MathText } from "./math-text";
import Swal from "sweetalert2";

type Props = {
  sectionId: string;
  topics: Topic[];
  questions: Question[];
  source: "supabase" | "sample";
};

export function TryoutRunner({ sectionId, topics, questions, source }: Props) {
  const availableTopics = topics.filter((topic) =>
    questions.some((q) => q.topicId === topic.id)
  );
  const defaultTopicId = availableTopics[0]?.id ?? topics[0]?.id ?? "";
  const [topicId, setTopicId] = useState<string>(defaultTopicId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [doubts, setDoubts] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const topicQuestions = useMemo(
    () => questions.filter((q) => q.topicId === topicId),
    [questions, topicId]
  );

  const currentQuestion = topicQuestions[currentIndex];
  const currentDoubt = Boolean(currentQuestion?.id && doubts[currentQuestion.id]);
  const scoring = useMemo(() => {
    let totalScore = 0;
    let maxScore = 0;
    let correctCount = 0;

    for (const q of topicQuestions) {
      const chosen = answers[q.id];
      if (q.questionType === "multiple_choice") {
        const correct = String(q.answerKey?.correct ?? "").toUpperCase();
        const per = Number(q.answerKey?.score ?? 1);
        maxScore += Number.isFinite(per) ? per : 1;
        if (chosen && chosen.toUpperCase() === correct) {
          totalScore += Number.isFinite(per) ? per : 1;
          correctCount += 1;
        }
        continue;
      }

      const entries = Object.entries(q.answerKey ?? {}).filter(([, v]) => typeof v === "number");
      const tkpMax = entries.reduce((m, [, v]) => Math.max(m, v as number), 0);
      maxScore += tkpMax;
      if (chosen) {
        const raw = (q.answerKey as Record<string, unknown>)[chosen.toUpperCase()];
        if (typeof raw === "number") {
          totalScore += raw;
        }
      }
    }

    return { totalScore, maxScore, correctCount };
  }, [topicQuestions, answers]);

  const handleSelectChoice = (questionId: string, choiceId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceId }));
  };

  const handleSubmit = async () => {
    const doubtAnsweredCount = topicQuestions.filter((q) => Boolean(answers[q.id]) && Boolean(doubts[q.id])).length;
    const answeredCount = Object.keys(answers).filter((id) =>
      topicQuestions.some((q) => q.id === id && answers[id])
    ).length;
    const unansweredCount = topicQuestions.length - answeredCount;

    const html =
      unansweredCount > 0 || doubtAnsweredCount > 0
        ? `Anda masih punya:<br/><br/>
           <b style="color:#be123c">${unansweredCount} belum dijawab</b> · <b style="color:#b45309">${doubtAnsweredCount} ragu-ragu</b><br/><br/>
           Apakah Anda yakin ingin submit dan melihat skor?`
        : "Semua soal sudah dijawab tanpa ragu. Apakah Anda yakin ingin submit dan melihat skor?";

    const res = await Swal.fire({
      title: "Submit Tryout?",
      html,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Submit",
      cancelButtonText: "Batal",
      reverseButtons: true,
    });

    if (res.isConfirmed) setSubmitted(true);
  };

  const handleReset = () => {
    setAnswers({});
    setSubmitted(false);
    setCurrentIndex(0);
  };

  const answeredCount = Object.keys(answers).filter((id) =>
    topicQuestions.some((q) => q.id === id && answers[id])
  ).length;

  const doubtAnsweredCount = topicQuestions.filter((q) => Boolean(answers[q.id]) && Boolean(doubts[q.id])).length;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Tryout cepat
          </p>
          <p className="text-sm text-slate-700">
            Pilih sub-topik lalu jawab soal. Skor ditampilkan setelah submit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
            Modul: {sectionId}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
            {topicQuestions.length} soal
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
            Jawaban: {answeredCount}/{topicQuestions.length}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
            Ragu-ragu: {doubtAnsweredCount}
          </span>
          <span
            className={`rounded-full border px-3 py-1 ${
              source === "supabase"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            Data: {source}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {topics.map((topic) => {
          const hasQuestions = questions.some((q) => q.topicId === topic.id);
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => {
                setTopicId(topic.id);
                setCurrentIndex(0);
                setSubmitted(false);
              }}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                topicId === topic.id
                  ? "border-sky-300 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              } ${!hasQuestions ? "opacity-60" : ""}`}
              disabled={!hasQuestions}
            >
              {topic.name}
            </button>
          );
        })}
      </div>

      {topicQuestions.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Belum ada soal untuk topik ini. Tambahkan data di Supabase tabel questions atau gunakan sample.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {topicQuestions.map((q, idx) => {
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
                  className={`h-9 w-9 rounded-md border text-xs font-semibold transition ${statusClass} ${
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
              <span>
                Soal {currentIndex + 1} / {topicQuestions.length}
              </span>
              <span>Topik: {topicId}</span>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={currentDoubt}
                disabled={!currentQuestion || submitted}
                onChange={() => {
                  if (!currentQuestion) return;
                  const id = currentQuestion.id;
                  setDoubts((prev) => ({ ...prev, [id]: !Boolean(prev[id]) }));
                }}
              />
              <span>Ragu-ragu</span>
            </label>

            <MathText 
              text={currentQuestion?.questionText || ""}
              className="mt-3 text-base font-semibold text-slate-900"
            />
            <div className="mt-3 space-y-2">
              {currentQuestion?.choices.map((choice) => {
                const choiceKey = choice.key.toUpperCase();
                const isSelected = answers[currentQuestion.id] === choiceKey;
                const correctKey =
                  currentQuestion.questionType === "multiple_choice"
                    ? String(currentQuestion.answerKey?.correct ?? "").toUpperCase()
                    : "";
                const isCorrect = submitted && correctKey && choiceKey === correctKey;
                const isWrong = submitted && isSelected && !isCorrect;

                return (
                  <button
                    key={choice.key}
                    type="button"
                    onClick={() => handleSelectChoice(currentQuestion.id, choiceKey)}
                    className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? "border-sky-300 bg-sky-50 text-slate-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    } ${isCorrect ? "border-emerald-200 bg-emerald-50" : ""} ${
                      isWrong ? "border-rose-200 bg-rose-50" : ""
                    }`}
                    disabled={submitted}
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700">
                      {choiceKey}
                    </span>
                    <MathText text={choice.text} className="text-slate-900" />
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
              onClick={() => setCurrentIndex((idx) => Math.min(topicQuestions.length - 1, idx + 1))}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              disabled={currentIndex === topicQuestions.length - 1}
            >
              Berikutnya
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              disabled={submitted}
            >
              Submit & lihat skor
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>

          {submitted ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <p className="font-semibold text-emerald-900">
                Skor: {scoring.totalScore} / {scoring.maxScore} ({
                  scoring.maxScore === 0 ? 0 : Math.round((scoring.totalScore / scoring.maxScore) * 100)
                }%)
              </p>
              <div className="mt-2 space-y-2 text-slate-700">
                {topicQuestions.map((q) => {
                  const userChoice = answers[q.id];
                  const correctKey =
                    q.questionType === "multiple_choice"
                      ? String(q.answerKey?.correct ?? "").toUpperCase()
                      : "";
                  const isCorrect = !!correctKey && userChoice?.toUpperCase() === correctKey;
                  const scoreObtained = (() => {
                    if (!userChoice) return 0;
                    if (q.questionType === "multiple_choice") {
                      const per = Number(q.answerKey?.score ?? 1);
                      return isCorrect ? (Number.isFinite(per) ? per : 1) : 0;
                    }
                    const raw = (q.answerKey as Record<string, unknown>)[userChoice.toUpperCase()];
                    return typeof raw === "number" ? raw : 0;
                  })();

                  return (
                    <div key={q.id} className="rounded-lg border border-emerald-200 bg-white p-3">
                      <MathText text={q.questionText} className="text-sm font-semibold text-slate-900" />
                      <p className="text-xs text-slate-600">
                        Jawaban: {userChoice ?? "-"}
                        {q.questionType === "multiple_choice" ? (
                          <>
                            {" "}· Kunci: {correctKey || "-"} ·{" "}
                            <span className={isCorrect ? "text-emerald-700" : "text-rose-700"}>
                              ({isCorrect ? "Benar" : "Salah"})
                            </span>
                          </>
                        ) : null}
                        {" "}· Skor: {scoreObtained}
                      </p>
                      {q.discussion ? (
                        <MathText text={q.discussion} className="mt-1 text-xs text-slate-600" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

        </div>
      )}
    </div>
  );
}
