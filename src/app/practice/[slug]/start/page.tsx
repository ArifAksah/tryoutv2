import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PracticeRunner } from "@/components/practice-runner";
import { submitPracticeAttempt } from "@/app/practice/actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ take?: string; questionIds?: string; package?: string }>; // Added package to searchParams
};

export default async function PracticeStartPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const user = await requireUser(`/practice/${slug}`); // Updated requireUser path

  // Fetch Category
  const supabase = await getSupabaseServerClient("read");
  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (!category) {
    redirect("/");
  }

  const { take, questionIds, package: packageParam } = await searchParams; // Destructure packageParam
  const takeCount = Math.max(1, Math.min(100, parseInt(take || "10", 10)));
  const packageNumber = packageParam ? parseInt(packageParam, 10) : null;

  let questions: any[] | null = []; // Changed type and initialized to empty array
  let durationMinutes: number | undefined;

  if (questionIds) {
    // 1. Direct Question IDs (e.g. from retry)
    const ids = questionIds.split(",").filter(Boolean); // Added filter(Boolean)
    if (ids.length > 0) { // Added check for empty ids array
      const { data } = await supabase
        .from("questions")
        .select(`
          id,
          question_text,
          question_type,
          options,
          answer_key,
          discussion,
          inserted_at
        `)
        .in("id", ids);
      questions = data;
    }
  } else if (packageNumber) {
    // 2. Package Mode
    // Deterministic ordering by 'inserted_at' or 'id' to ensure "Package 1" is always the same
    // Pages are 1-indexed (Package 1 = Offset 0)
    const pageSize = 10;
    const offset = (packageNumber - 1) * pageSize;

    const { data } = await supabase
      .from("questions")
      .select(`
        id,
        question_text,
        question_type,
        options,
        answer_key,
        discussion,
        inserted_at
      `)
      .eq("category_id", category.id)
      .order("inserted_at", { ascending: true }) // Deterministic order with correct column
      .range(offset, offset + pageSize - 1);

    questions = data;
    durationMinutes = 10; // 10 minutes for practice packages
  } else { // Changed to else for fallback
    // 3. Random / Custom Mode
    const { data } = await supabase.rpc("pick_random_questions", {
      p_category_id: category.id,
      p_take: takeCount,
    });
    questions = data;
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-xl font-semibold text-slate-700">Tidak ada soal yang tersedia.</p>
        <Link href={`/practice/${slug}`} className="text-sky-600 hover:underline">
          Kembali
        </Link>
      </div>
    );
  }

  const formattedQuestions = (questions as any[]).map((q, idx) => ({ // Changed type assertion to any[]
    id: q.id,
    questionText: q.question_text, // Changed from content to question_text
    questionType: q.question_type,
    options: ((q.options as any[]) ?? []).map((opt: any) => ({ // Updated options mapping
      key: opt.key,
      text: opt.text || opt.value, // Fix: Use 'text' (from JSON/DB) or fallback to 'value'
    })),
    answerKey: q.answer_key,
    discussion: q.discussion,
    order: idx + 1,
  }));

  // Get user's attempt count for this specific session type if needed, 
  // or just general attempt count.
  const { count } = await supabase
    .from("user_practice_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("category_id", category.id);

  const initialAttemptNumber = (count ?? 0) + 1;

  // Get recent attempts
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
      durationMinutes={durationMinutes} // Passed durationMinutes
      packageNumber={packageNumber ?? undefined} // Passed packageNumber
    />
  );
}

