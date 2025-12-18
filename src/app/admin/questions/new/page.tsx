import Link from "next/link";

import { fetchExamStructure } from "@/lib/exam-structure";
import { requireAdminUser } from "@/lib/auth";

import { createQuestion } from "../actions";
import { AdminQuestionForm } from "../_components/question-form";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ section?: string; topic?: string; category?: string; return_to?: string }>;
};

export default async function NewAdminQuestionPage({ searchParams }: Props) {
  await requireAdminUser("/admin/questions/new");

  const { section: sectionParam, topic: topicParam, return_to } = await searchParams;
  const { sections } = await fetchExamStructure({ mode: "admin" });

  // Try to find section and topic from category param if provided
  let selectedSection = sections.find((s) => s.id === sectionParam) ?? null;
  let selectedTopic = selectedSection?.topics.find((t) => t.id === topicParam) ?? null;
  
  // If no section/topic from params, use first available
  if (!selectedSection && sections.length > 0) {
    selectedSection = sections[0];
  }
  if (!selectedTopic && selectedSection?.topics.length) {
    selectedTopic = selectedSection.topics[0];
  }

  const returnTo =
    return_to ||
    (selectedSection && selectedTopic
      ? `/admin/questions?section=${encodeURIComponent(selectedSection.id)}&topic=${encodeURIComponent(
          selectedTopic.id
        )}`
      : "/admin/questions");

  if (!selectedSection || !selectedTopic) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Tambah Soal</h1>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          Section/topik belum tersedia.
        </div>
        <Link
          href="/admin/questions"
          className="inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Kembali ke bank soal
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</p>
          <h1 className="text-2xl font-bold text-slate-900">Tambah Soal</h1>
          <p className="text-sm text-slate-700">
            Section <span className="font-semibold text-slate-900">{selectedSection.name}</span> · Topik
            <span className="font-semibold text-slate-900"> {selectedTopic.name}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href={returnTo}
            className="inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Kembali
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <AdminQuestionForm
            mode="create"
            sections={sections}
            returnTo={returnTo}
            action={createQuestion}
            initial={{
              id: "",
              sectionId: selectedSection.id,
              topicId: selectedTopic.id,
              questionText: "",
              questionType: "multiple_choice",
              choicesText: "",
              correctKey: "",
              correctScore: "5",
              scoreMapText: "A=1\nB=2\nC=3\nD=4\nE=5",
              discussion: "",
            }}
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Checklist</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Minimal 2 pilihan jawaban</li>
              <li>Multiple choice: isi kunci jawaban (A/B/C/...)</li>
              <li>TKP: isi skema skor (A=1, B=3, ...)</li>
              <li>Pembahasan opsional</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
