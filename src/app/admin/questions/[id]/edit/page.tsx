import Link from "next/link";

import { fetchExamStructure } from "@/lib/exam-structure";
import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import { updateQuestion } from "../../actions";
import { AdminQuestionForm } from "../../_components/question-form";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ return_to?: string }>;
};

type SupabaseQuestionRow = {
  id: string;
  category_id: string;
  question_text: string;
  question_type: string;
  options: unknown;
  answer_key: unknown;
  discussion: string | null;
};

function asChoiceArray(value: unknown): Array<{ key: string; text: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as { key?: unknown; id?: unknown; text?: unknown };
      const rawKey = typeof obj.key === "string" ? obj.key : typeof obj.id === "string" ? obj.id : undefined;
      if (typeof rawKey !== "string" || typeof obj.text !== "string") return null;
      return { key: rawKey.toUpperCase(), text: obj.text };
    })
    .filter((x): x is { key: string; text: string } => x !== null);
}

function formatChoicesText(choices: Array<{ key: string; text: string }>): string {
  return choices
    .map((c) => {
      const prefix = c.key ? `${c.key}. ` : "";
      return `${prefix}${c.text}`;
    })
    .join("\n");
}

function formatScoreMapText(answerKey: unknown): string {
  if (!answerKey || typeof answerKey !== "object" || Array.isArray(answerKey)) return "";
  const entries = Object.entries(answerKey as Record<string, unknown>)
    .filter(([k, v]) => k !== "correct" && k !== "score" && typeof v === "number")
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k.toUpperCase()}=${v}`).join("\n");
}

export default async function EditAdminQuestionPage({ params, searchParams }: Props) {
  await requireAdminUser("/admin/questions");

  const { id } = await params;
  const { return_to } = await searchParams;
  const returnTo = return_to || "/admin/questions";

  const supabase = await getSupabaseServerClient("read");
  const { data, error } = await supabase
    .from("questions")
    .select("id, category_id, question_text, question_type, options, answer_key, discussion")
    .eq("id", id)
    .single();

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Edit Soal</h1>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          Soal tidak ditemukan. {error ? `(${error.message})` : null}
        </div>
        <Link
          href={returnTo}
          className="inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Kembali
        </Link>
      </div>
    );
  }

  const row = data as SupabaseQuestionRow;
  const choices = asChoiceArray(row.options);
  const answerKey = (row.answer_key ?? {}) as Record<string, unknown>;
  const { sections } = await fetchExamStructure({ mode: "admin" });

  const { data: categoryRow } = await supabase
    .from("categories")
    .select("id, slug, parent_id")
    .eq("id", row.category_id)
    .maybeSingle();

  let sectionSlug = categoryRow?.slug ?? "";
  let topicSlug = categoryRow?.slug ?? "";
  if (categoryRow?.parent_id) {
    const { data: parentRow } = await supabase
      .from("categories")
      .select("slug")
      .eq("id", categoryRow.parent_id)
      .maybeSingle();
    if (parentRow?.slug) {
      if (parentRow.slug === "skd" || parentRow.slug === "skb") {
        sectionSlug = categoryRow.slug;
        topicSlug = categoryRow.slug;
      } else {
        sectionSlug = parentRow.slug;
        topicSlug = categoryRow.slug;
      }
    }
  }

  const questionType = row.question_type === "scale_tkp" ? "scale_tkp" : "multiple_choice";
  const correctKey = String(answerKey.correct ?? "").toUpperCase();
  const correctScore = String(answerKey.score ?? "5");
  const scoreMapText = formatScoreMapText(answerKey);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</p>
          <h1 className="text-2xl font-bold text-slate-900">Edit Soal</h1>
          <p className="text-sm text-slate-700">
            ID: <span className="font-semibold text-slate-900">{row.id}</span>
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
            mode="edit"
            sections={sections}
            returnTo={returnTo}
            action={updateQuestion}
            initial={{
              id: row.id,
              sectionId: sectionSlug,
              topicId: topicSlug,
              questionText: row.question_text,
              questionType,
              choicesText: formatChoicesText(choices),
              correctKey,
              correctScore,
              scoreMapText,
              discussion: row.discussion ?? "",
            }}
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Info</p>
            <div className="mt-3 space-y-2">
              <p className="text-sm">
                Kategori: <span className="font-semibold text-slate-900">{topicSlug || "-"}</span>
              </p>
              <p className="text-sm">
                Parent: <span className="font-semibold text-slate-900">{sectionSlug || "-"}</span>
              </p>
              <p className="text-sm">
                Tipe: <span className="font-semibold text-slate-900">{questionType}</span>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
