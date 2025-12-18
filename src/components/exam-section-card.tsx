import Link from "next/link";
import { ExamSection, Topic } from "@/lib/exam-structure";
import { ConfirmStartTryoutButton } from "@/components/confirm-start-tryout-button";

type AccentStyles = {
  container: string;
  badge: string;
  bullet: string;
};

const accentByType: Record<ExamSection["type"], AccentStyles> = {
  SKD: {
    container: "border-sky-200 bg-white",
    badge: "border-sky-200 bg-sky-50 text-sky-700",
    bullet: "bg-sky-500",
  },
  SKB: {
    container: "border-emerald-200 bg-white",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    bullet: "bg-emerald-500",
  },
};

const badgeByCode: Record<string, string> = {
  TWK: "border-sky-200 bg-sky-50 text-sky-700",
  TIU: "border-violet-200 bg-violet-50 text-violet-700",
  TKP: "border-amber-200 bg-amber-50 text-amber-700",
};

function TopicItem({ topic, bulletClass }: { topic: Topic; bulletClass: string }) {
  return (
    <li className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span className={`mt-1 h-2 w-2 rounded-full ${bulletClass}`} aria-hidden />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold text-slate-900">{topic.name}</p>
        {topic.description ? (
          <p className="text-sm leading-relaxed text-slate-700">{topic.description}</p>
        ) : null}
        {(topic.questionCount || topic.durationMinutes) && (
          <p className="text-xs text-slate-500">
            {topic.questionCount ? `${topic.questionCount} soal` : ""}
            {topic.questionCount && topic.durationMinutes ? " · " : ""}
            {topic.durationMinutes ? `${topic.durationMinutes} menit` : ""}
          </p>
        )}
      </div>
    </li>
  );
}

export function ExamSectionCard({ section }: { section: ExamSection }) {
  const accent = accentByType[section.type];
  const codeBadge = badgeByCode[section.code] ?? accent.badge;
  // Fix: Each section (TWK/TIU/TKP) should have its own tryout URL
  const realTryoutHref = `/tryout/real/${section.id}`;

  return (
    <article
      className={`flex h-full flex-col gap-4 rounded-lg border px-5 py-4 ${accent.container}`}
    >
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          <span className={`rounded-full border px-3 py-1 ${accent.badge}`}>
            {section.type}
          </span>
          <span className={`rounded-full border px-3 py-1 ${codeBadge}`}>{section.code}</span>
          {section.school ? (
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">
              {section.school}
            </span>
          ) : null}
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900">{section.name}</h3>
          {section.description ? (
            <p className="text-sm leading-relaxed text-slate-700">{section.description}</p>
          ) : null}
        </div>
      </header>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Sub-topik yang diuji
        </p>
        <ul className="space-y-2">
          {section.topics.map((topic) => (
            <TopicItem key={topic.id} topic={topic} bulletClass={accent.bullet} />
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/sections/${section.id}`}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          Latihan per Sub-Topik 📚
        </Link>
        <ConfirmStartTryoutButton
          href={realTryoutHref}
          durationMinutes={section.type === "SKB" ? 60 : null}
          title={`Mulai Tryout Real: ${section.code}?`}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
        >
          Tryout Real ⏱️
        </ConfirmStartTryoutButton>
      </div>
    </article>
  );
}
