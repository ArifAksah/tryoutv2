import Link from "next/link";
import { ExamSection } from "@/lib/exam-structure";
import { Question } from "@/lib/questions";
import { ConfirmStartTryoutButton } from "@/components/confirm-start-tryout-button";

interface SkbSectionCardProps {
  section: ExamSection;
  questions: Question[];
}

export function SkbSectionCard({ section, questions }: SkbSectionCardProps) {
  // Take only the first 10 questions to prevent overcrowding
  const displayQuestions = questions.slice(0, 10);
  const hasMore = questions.length > 10;

  return (
    <article className="flex h-full flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
            SKB
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {section.code}
          </span>
        </div>
        <h3 className="text-lg font-bold text-slate-900">{section.name}</h3>
        {section.description ? (
          <p className="text-sm text-slate-600 line-clamp-2">{section.description}</p>
        ) : null}
      </header>

      <div className="flex-1 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Soal Tersedia ({questions.length})
          </p>
          <Link
            href={`/sections/${section.id}`}
            className="text-xs font-semibold text-sky-600 hover:underline"
          >
            Lihat Semua
          </Link>
        </div>

        {displayQuestions.length > 0 ? (
          <ul className="space-y-2">
            {displayQuestions.map((q) => (
              <li key={q.id} className="group flex items-start justify-between gap-3 rounded-md bg-white p-2.5 shadow-sm ring-1 ring-slate-200">
                <div className="flex-1 space-y-1">
                  <p className="line-clamp-2 text-sm text-slate-800">
                    {q.questionText}
                  </p>
                  <p className="text-xs text-slate-400">
                    Topik: {q.topicId}
                  </p>
                </div>
                {/* Could add a direct play button or link to specific question if desired, 
                    but usually we start practice by ID. 
                    For now, link to the section practice.
                */}
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-4 text-center text-sm text-slate-500">
            Belum ada soal tersedia.
          </div>
        )}

        {hasMore && (
          <div className="text-center pt-1">
            <span className="text-xs text-slate-400">...dan {questions.length - 10} soal lainnya</span>
          </div>
        )}
      </div>

      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Pilih Paket Latihan
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {questions.length > 0 ? (
            Array.from({ length: Math.ceil(questions.length / 10) }).map((_, idx) => {
              const start = idx * 10;
              const end = start + 10;
              const chunk = questions.slice(start, end);
              const ids = chunk.map((q) => q.id).join(",");
              const count = chunk.length;

              return (
                <Link
                  key={idx}
                  href={`/practice/${section.id}/start?questionIds=${ids}`}
                  className="group flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-3 text-center transition hover:border-sky-300 hover:bg-sky-50"
                >
                  <span className="text-sm font-bold text-slate-900 group-hover:text-sky-700">
                    Paket {idx + 1}
                  </span>
                  <span className="text-xs text-slate-500">
                    {count} Soal
                  </span>
                </Link>
              );
            })
          ) : (
            <div className="col-span-2 text-center text-xs text-slate-400">
              Belum ada paket tersedia
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href={`/sections/${section.id}`}
          className="flex-1 inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          Lihat Semua 📚
        </Link>
        <ConfirmStartTryoutButton
          href={`/tryout/real/${section.id}`}
          durationMinutes={60}
          title={`Mulai Tryout SKB: ${section.code}?`}
          className="flex-1 inline-flex items-center justify-center rounded-lg border border-purple-600 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50"
        >
          Tryout ⏱️
        </ConfirmStartTryoutButton>
      </div>
    </article>
  );
}
