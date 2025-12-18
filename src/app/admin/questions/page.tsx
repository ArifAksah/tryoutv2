import Link from "next/link";

import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import { deleteQuestion } from "./actions";
import { CascadingFilter } from "./_components/cascading-filter";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Revalidate on every request but with better caching

const ITEMS_PER_PAGE = 50;

type Props = {
  searchParams: Promise<{ section?: string; topic?: string; subtopic?: string; q?: string; page?: string }>;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  type: "subject" | "topic" | "subtopic" | null;
};

type SupabaseQuestionRow = {
  id: string;
  legacy_id: string | null;
  category_id: string;
  question_text: string;
  question_type: string;
  options: unknown;
  answer_key: unknown;
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

function truncate(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export default async function AdminQuestionsPage({ searchParams }: Props) {
  await requireAdminUser("/admin/questions");

  const { section: sectionParam, topic: topicParam, subtopic: subtopicParam, q: qParam, page: pageParam } = await searchParams;
  const q = typeof qParam === "string" ? qParam.trim().slice(0, 80) : "";
  const qSafe = q.replace(/[%_]/g, "");
  const currentPage = Math.max(1, parseInt(pageParam || "1", 10));

  const supabase = await getSupabaseServerClient("read");

  // Fetch all categories
  const { data: allCategories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, type")
    .order("name");

  void categoriesError;

  const categories = (allCategories ?? []) as Category[];

  // Build category hierarchy and pre-compute paths
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  
  const categoryPathCache = new Map<string, string>();
  
  const getCategoryPath = (cat: Category): string => {
    // Check cache first
    if (categoryPathCache.has(cat.id)) {
      return categoryPathCache.get(cat.id)!;
    }
    
    // Prevent infinite loop by tracking visited
    const visited = new Set<string>();
    const parts: string[] = [];
    let current: Category | undefined = cat;
    
    while (current) {
      // Check for circular reference
      if (visited.has(current.id)) {
        break;
      }
      visited.add(current.id);
      
      parts.unshift(current.name);
      current = current.parent_id ? categoryMap.get(current.parent_id) : undefined;
      
      // Safety limit
      if (parts.length > 10) {
        break;
      }
    }
    
    const path = parts.join(" > ");
    categoryPathCache.set(cat.id, path);
    return path;
  };
  
  // Pre-compute all category paths to avoid repeated recursive calls
  categories.forEach((cat) => {
    getCategoryPath(cat);
  });

  // Build parent_id index for faster lookups
  const childrenByParent = new Map<string | null, Category[]>();
  categories.forEach((cat) => {
    const parentId = cat.parent_id ?? null;
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, []);
    }
    childrenByParent.get(parentId)!.push(cat);
  });

  // Get hierarchy levels using index
  const roots = childrenByParent.get(null) ?? []; // SKD, SKB
  
  const rootIds = new Set(roots.map((r) => r.id));
  const sections = categories.filter((c) => c.parent_id && rootIds.has(c.parent_id)); // TWK, TIU, TKP, etc
  
  const selectedSection = sectionParam ? sections.find((s) => s.id === sectionParam) : null;
  const topics = selectedSection 
    ? (childrenByParent.get(selectedSection.id) ?? [])
    : [];
  
  const selectedTopic = topicParam ? topics.find((t) => t.id === topicParam) : null;
  const subtopics = selectedTopic
    ? (childrenByParent.get(selectedTopic.id) ?? [])
    : [];
  
  const selectedSubtopic = subtopicParam ? subtopics.find((st) => st.id === subtopicParam) : null;

  // Determine which category to filter by (most specific level)
  const filterCategoryId = selectedSubtopic?.id || selectedTopic?.id || selectedSection?.id || null;

  // Build return URL with current filters
  const buildReturnUrl = (page?: number) => {
    const params = new URLSearchParams();
    if (sectionParam) params.set("section", sectionParam);
    if (topicParam) params.set("topic", topicParam);
    if (subtopicParam) params.set("subtopic", subtopicParam);
    if (q) params.set("q", q);
    if (page && page > 1) params.set("page", page.toString());
    return `/admin/questions${params.toString() ? `?${params.toString()}` : ""}`;
  };
  const returnTo = buildReturnUrl(currentPage);

  // Count total questions first
  let countQuery = supabase
    .from("questions")
    .select("id", { count: "exact", head: true });

  if (filterCategoryId) {
    countQuery = countQuery.eq("category_id", filterCategoryId);
  }

  if (qSafe) {
    countQuery = countQuery.or(`legacy_id.ilike.%${qSafe}%,question_text.ilike.%${qSafe}%`);
  }

  const { count: totalCount } = await countQuery;
  const total = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const validPage = Math.min(currentPage, totalPages);
  const offset = (validPage - 1) * ITEMS_PER_PAGE;

  // Build query with pagination
  let query = supabase
    .from("questions")
    .select("id, legacy_id, category_id, question_text, question_type, options, answer_key")
    .order("inserted_at", { ascending: false })
    .range(offset, offset + ITEMS_PER_PAGE - 1);

  // Filter by category if selected (most specific level)
  if (filterCategoryId) {
    query = query.eq("category_id", filterCategoryId);
  }

  // Search filter
  if (qSafe) {
    query = query.or(`legacy_id.ilike.%${qSafe}%,question_text.ilike.%${qSafe}%`);
  }

  const { data, error } = await query;
  
  const questions = (data ?? []) as SupabaseQuestionRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Bank Soal</h1>
          {selectedSection || selectedTopic || selectedSubtopic ? (
            <p className="text-sm text-slate-700">
              {selectedSection?.name}
              {selectedTopic ? ` → ${selectedTopic.name}` : ""}
              {selectedSubtopic ? ` → ${selectedSubtopic.name}` : ""}
            </p>
          ) : (
            <p className="text-sm text-slate-600">Semua kategori</p>
          )}
          <p className="text-xs text-slate-500">
            {total} soal total · Halaman {validPage} dari {totalPages}
            {q ? (
              <>
                {" "}
                · Hasil pencarian: <span className="font-semibold text-slate-700">{q}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/admin/questions/new${sectionParam ? `?section=${encodeURIComponent(sectionParam)}` : ""}${topicParam ? `&topic=${encodeURIComponent(topicParam)}` : ""}${returnTo ? `&return_to=${encodeURIComponent(returnTo)}` : ""}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tambah Soal
          </Link>
          <Link
            href="/admin/questions/import"
            className="inline-flex items-center justify-center rounded-lg border border-sky-600 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
          >
            📤 Import JSON
          </Link>
          <Link
            href={returnTo}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <CascadingFilter
            allCategories={categories}
            sections={sections}
            initialSection={sectionParam}
            initialTopic={topicParam}
            initialSubtopic={subtopicParam}
            initialQuery={q}
          />

          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
            <p className="text-xs font-semibold text-sky-900">💡 Tips Filter:</p>
            <ul className="mt-2 space-y-1 text-xs text-sky-800">
              <li>• Filter bertingkat: Section → Topic → Sub-topic</li>
              <li>• Pilih Section, dropdown Topic otomatis muncul</li>
              <li>• Pilih Topic, dropdown Sub-topic otomatis muncul</li>
              <li>• Klik &quot;Tampilkan&quot; untuk apply filter</li>
              <li>• &quot;Reset&quot; untuk hapus semua filter</li>
            </ul>
          </div>
        </aside>

        <section className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Supabase error: {error.message}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">Daftar soal</p>
                <p className="text-xs text-slate-500">
                  {q ? (
                    <>
                      Menampilkan hasil untuk <span className="font-semibold text-slate-700">{q}</span>
                    </>
                  ) : (
                    "Menampilkan semua soal di topik ini"
                  )}
                  {" "}· Halaman {validPage}/{totalPages}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                {offset + 1}-{Math.min(offset + ITEMS_PER_PAGE, total)} dari {total}
              </p>
            </div>

            {questions.length === 0 ? (
              <div className="px-4 py-10 text-sm text-slate-700">
                {q ? "Tidak ada soal yang cocok dengan pencarian." : "Belum ada soal untuk topik ini."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Prompt</th>
                      <th className="px-4 py-3">Kunci</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {questions.map((q) => {
                      const choices = asChoiceArray(q.options);
                      const answerKey = (q.answer_key ?? {}) as Record<string, unknown>;
                      const correctKey = String(answerKey.correct ?? "").toUpperCase();
                      const correct = choices.find((c) => c.key === correctKey)?.text;
                      const isTkp = q.question_type === "scale_tkp";
                      const questionCategory = categoryMap.get(q.category_id);
                      const categoryPath = questionCategory ? getCategoryPath(questionCategory) : "Unknown";

                      return (
                        <tr key={q.id} className="align-top">
                          <td className="px-4 py-4">
                            <p className="text-xs text-slate-500">{q.id.slice(0, 8)}</p>
                            <p className="mt-1 text-xs text-slate-600">{categoryPath}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-700">{q.question_type}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm text-slate-700">{truncate(q.question_text, 180)}</p>
                          </td>
                          <td className="px-4 py-4">
                            {isTkp ? (
                              <p className="text-sm font-semibold text-slate-900">TKP Scale</p>
                            ) : (
                              <>
                                <p className="text-sm font-semibold text-emerald-700">{correctKey || "-"}</p>
                                {correct ? (
                                  <p className="mt-1 text-xs text-slate-500">{truncate(correct, 60)}</p>
                                ) : null}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <Link
                                href={`/admin/questions/${encodeURIComponent(
                                  q.id
                                )}/edit?return_to=${encodeURIComponent(returnTo)}`}
                                className="rounded-md border border-sky-300 px-3 py-1.5 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                              >
                                Edit
                              </Link>

                              <form action={deleteQuestion}>
                                <input type="hidden" name="id" value={q.id} />
                                <input type="hidden" name="return_to" value={returnTo} />
                                <button
                                  type="submit"
                                  className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                                >
                                  Hapus
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
                <div className="flex gap-2">
                  {validPage > 1 ? (
                    <Link
                      href={buildReturnUrl(validPage - 1)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Previous
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-400 cursor-not-allowed"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Previous
                    </button>
                  )}
                  {validPage < totalPages ? (
                    <Link
                      href={buildReturnUrl(validPage + 1)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Next
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-400 cursor-not-allowed"
                    >
                      Next
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-600">
                  Halaman {validPage} dari {totalPages}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
