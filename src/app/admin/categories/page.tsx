import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { CategoryCard } from "./_components/category-card";

export const dynamic = "force-dynamic";

export type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  type: "subject" | "topic" | "subtopic" | null;
  children?: Category[];
  questionCount?: number;
};

export default async function CategoriesPage() {
  await requireAdminUser("/admin/categories");

  const supabase = await getSupabaseServerClient("read");

  // Fetch all categories
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, type")
    .order("name");

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Kategori & Topik</h1>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700">
          Error: {error.message}
        </div>
      </div>
    );
  }

  // Get question count per category
  const { data: questionCounts } = await supabase
    .from("questions")
    .select("category_id")
    .then((res) => {
      if (!res.data) return { data: [] };
      const counts: Record<string, number> = {};
      res.data.forEach((q) => {
        counts[q.category_id] = (counts[q.category_id] || 0) + 1;
      });
      return {
        data: Object.entries(counts).map(([category_id, count]) => ({
          category_id,
          count,
        })),
      };
    });

  const countMap: Record<string, number> = {};
  questionCounts?.forEach((c) => {
    countMap[c.category_id] = c.count;
  });

  // Build tree structure
  const categoryMap: Record<string, Category> = {};
  const rootCategories: Category[] = [];

  categories?.forEach((cat) => {
    categoryMap[cat.id] = {
      ...cat,
      children: [],
      questionCount: countMap[cat.id] || 0,
    };
  });

  categories?.forEach((cat) => {
    if (cat.parent_id) {
      const parent = categoryMap[cat.parent_id];
      if (parent) {
        parent.children?.push(categoryMap[cat.id]!);
      }
    } else {
      rootCategories.push(categoryMap[cat.id]!);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kategori & Topik</h1>
          <p className="text-sm text-slate-600">
            Kelola struktur kategori hierarkis untuk soal SKD dan SKB
          </p>
        </div>
        <Link
          href="/admin/categories/new"
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          + Tambah Kategori
        </Link>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">💡 Struktur Hierarkis</p>
        <ul className="mt-2 space-y-1 text-amber-800">
          <li>• <strong>Subject</strong>: Level 1 (SKD, TWK, TIU, TKP, Ekonomi, dll)</li>
          <li>• <strong>Topic</strong>: Level 2 (Pancasila, Bilangan Deret, Mikroekonomi)</li>
          <li>• <strong>Subtopic</strong>: Level 3 (Detail dari topic)</li>
        </ul>
      </div>

      <div className="space-y-4">
        {rootCategories.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-600">Belum ada kategori. Buat kategori pertama!</p>
          </div>
        ) : (
          rootCategories.map((category) => (
            <CategoryCard key={category.id} category={category} level={1} />
          ))
        )}
      </div>
    </div>
  );
}
