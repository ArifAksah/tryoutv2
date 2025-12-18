import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { CategoryForm } from "../../_components/category-form";
import { updateCategory } from "../../actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditCategoryPage({ params }: Props) {
  await requireAdminUser("/admin/categories");
  const { id } = await params;

  const supabase = await getSupabaseServerClient("read");

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .single();

  if (!category) {
    notFound();
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, type")
    .order("name");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Edit Kategori</h1>
        <p className="text-sm text-slate-600">
          Update informasi kategori {category.name}
        </p>
      </div>

      <CategoryForm
        mode="edit"
        action={updateCategory}
        categories={categories || []}
        initial={{
          id: category.id,
          name: category.name,
          slug: category.slug,
          parentId: category.parent_id || "",
          type: category.type || "subject",
          durationMinutes: category.duration_minutes ? String(category.duration_minutes) : "",
        }}
      />
    </div>
  );
}
