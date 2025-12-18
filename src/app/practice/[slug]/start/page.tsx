import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PracticeRunner } from "@/components/practice-runner";
import { submitPracticeAttempt } from "@/app/practice/actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ take?: string }>;
};

export default async function PracticeStartPage({ params, searchParams }: Props) {
  const user = await requireUser(`/practice/${(await params).slug}/start`);
  const { slug } = await params;
  const { take } = await searchParams;
  const takeCount = Math.max(1, Math.min(100, parseInt(take || "10", 10)));

  const supabase = await getSupabaseServerClient("read");

  // Get category
  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (!category) {
    redirect("/");
  }

  // Get questions from this category (with recursive descendants)
  const { data: questions } = await supabase.rpc("pick_random_questions", {
    p_category_id: category.id,
    p_take: takeCount,
  });

  if (!questions || questions.length === 0) {
    return (
      <div className="mx-auto min-h-screen max-w-3xl space-y-6 p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-semibold text-amber-900">Belum ada soal untuk topik ini.</p>
          <a href={`/practice/${slug}`} className="mt-3 text-sm text-amber-700 underline">
            Kembali
          </a>
        </div>
      </div>
    );
  }

  type DbQuestion = {
    id: string;
    question_text: string;
    question_type: "multiple_choice" | "scale_tkp";
    options: unknown;
    answer_key: unknown;
    discussion: string | null;
  };

  const formattedQuestions = (questions as DbQuestion[]).map((q, idx) => ({
    id: q.id,
    questionText: q.question_text,
    questionType: q.question_type,
    options: Array.isArray(q.options)
      ? q.options.map((opt: unknown) => ({
          key: typeof opt === "string" ? opt : (opt as { key?: string }).key || "",
          text:
            typeof opt === "string"
              ? opt
              : (opt as { text?: string; value?: string }).text ||
                (opt as { text?: string; value?: string }).value ||
                "",
        }))
      : [],
    answerKey: (q.answer_key || {}) as Record<string, string | number>,
    discussion: q.discussion || null,
    order: idx + 1,
  }));

  const { count } = await supabase
    .from("user_practice_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("category_id", category.id);

  const initialAttemptNumber = (count ?? 0) + 1;

  const { data: recent } = await supabase
    .from("user_practice_sessions")
    .select("id, started_at, finished_at, score_total, max_score, correct_count, total_questions")
    .eq("user_id", user.id)
    .eq("category_id", category.id)
    .order("started_at", { ascending: false })
    .limit(10);

  return (
    <PracticeRunner
      categoryId={category.id}
      categorySlug={slug}
      categoryName={category.name}
      questions={formattedQuestions}
      submitAction={submitPracticeAttempt}
      initialAttemptNumber={initialAttemptNumber}
      initialRecentAttempts={(recent ?? []) as Array<{
        id: string;
        started_at: string;
        finished_at: string | null;
        score_total: number;
        max_score: number;
        correct_count: number;
        total_questions: number;
      }>}
    />
  );
}
