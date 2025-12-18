import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminQuestionsDebugPage() {
  console.log("[DEBUG] Page rendering started");

  await requireAdminUser("/admin/questions/debug");

  const supabase = await getSupabaseServerClient("read");

  // Test 1: Count categories
  console.log("[DEBUG] Counting categories...");
  const { count: categoryCount } = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true });
  console.log(`[DEBUG] Total categories: ${categoryCount}`);

  // Test 2: Count questions
  console.log("[DEBUG] Counting questions...");
  const { count: questionCount } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true });
  console.log(`[DEBUG] Total questions: ${questionCount}`);

  // Test 3: Fetch sample categories
  console.log("[DEBUG] Fetching sample categories...");
  const { data: sampleCategories } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id")
    .limit(10);

  // Test 4: Fetch sample questions
  console.log("[DEBUG] Fetching sample questions...");
  const { data: sampleQuestions } = await supabase
    .from("questions")
    .select("id, question_text, category_id")
    .limit(5);

  return (
    <div className="space-y-6 p-8">
      <h1 className="text-2xl font-bold">Debug Page</h1>
      
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Statistics</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>Total Categories: {categoryCount}</li>
            <li>Total Questions: {questionCount}</li>
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Sample Categories</h2>
          <pre className="mt-2 overflow-auto text-xs">
            {JSON.stringify(sampleCategories, null, 2)}
          </pre>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Sample Questions</h2>
          <pre className="mt-2 overflow-auto text-xs">
            {JSON.stringify(
              sampleQuestions?.map((q) => ({
                id: q.id,
                text: q.question_text.slice(0, 80),
                category_id: q.category_id,
              })),
              null,
              2
            )}
          </pre>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-800">
            ✅ If you can see this page, server rendering is working.
          </p>
          <p className="mt-2 text-sm text-emerald-800">
            Check your terminal/console for timing logs.
          </p>
        </div>
      </div>
    </div>
  );
}
