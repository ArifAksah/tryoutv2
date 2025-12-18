import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { CategoryForm } from "../_components/category-form";
import { createCategory } from "../actions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ parent?: string }>;
};

export default async function NewCategoryPage({ searchParams }: Props) {
  await requireAdminUser("/admin/categories/new");
  const { parent } = await searchParams;

  const supabase = await getSupabaseServerClient("read");

  // Fetch all categories for parent selection
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, type")
    .order("name");

  // Determine suggested type based on parent
  let suggestedType: "subject" | "topic" | "subtopic" = "subject";
  if (parent) {
    const parentCat = categories?.find((c) => c.id === parent);
    if (parentCat?.type === "subject") suggestedType = "topic";
    else if (parentCat?.type === "topic") suggestedType = "subtopic";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tambah Kategori Baru</h1>
        <p className="text-sm text-slate-600">
          Buat kategori baru untuk mengelompokkan soal
        </p>
      </div>

      <CategoryForm
        mode="create"
        action={createCategory}
        categories={categories || []}
        initial={{
          id: "",
          name: "",
          slug: "",
          parentId: parent || "",
          type: suggestedType,
          durationMinutes: "",
        }}
      />
    </div>
  );
}
