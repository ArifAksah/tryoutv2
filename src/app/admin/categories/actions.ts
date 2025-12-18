"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminActionState } from "../questions/actions";

export async function createCategory(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminUser("/admin/categories");

  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const parentId = String(formData.get("parent_id") || "").trim() || null;
  const type = String(formData.get("type") || "").trim();
  const durationRaw = String(formData.get("duration_minutes") || "").trim();
  const durationMinutes = durationRaw ? Math.trunc(Number(durationRaw)) : null;

  if (!name) return { ok: false, error: "Nama kategori wajib diisi." };
  if (!slug) return { ok: false, error: "Slug wajib diisi." };
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, error: "Slug hanya boleh huruf kecil, angka, dan dash (-)." };
  }
  if (!["subject", "topic", "subtopic"].includes(type)) {
    return { ok: false, error: "Tipe tidak valid." };
  }
  if (durationMinutes !== null && (!Number.isFinite(durationMinutes) || durationMinutes <= 0)) {
    return { ok: false, error: "Durasi harus berupa angka > 0 (menit) atau dikosongkan." };
  }

  const supabase = await getSupabaseServerClient("write");

  // Check if slug already exists
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: `Slug "${slug}" sudah digunakan. Pilih slug lain.` };
  }

  // Insert new category
  const { error } = await supabase.from("categories").insert({
    name,
    slug,
    parent_id: parentId,
    type,
    duration_minutes: durationMinutes,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

export async function updateCategory(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminUser("/admin/categories");

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const parentId = String(formData.get("parent_id") || "").trim() || null;
  const type = String(formData.get("type") || "").trim();
  const durationRaw = String(formData.get("duration_minutes") || "").trim();
  const durationMinutes = durationRaw ? Math.trunc(Number(durationRaw)) : null;

  if (!id) return { ok: false, error: "ID kategori tidak valid." };
  if (!name) return { ok: false, error: "Nama kategori wajib diisi." };
  if (!slug) return { ok: false, error: "Slug wajib diisi." };
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, error: "Slug hanya boleh huruf kecil, angka, dan dash (-)." };
  }
  if (!["subject", "topic", "subtopic"].includes(type)) {
    return { ok: false, error: "Tipe tidak valid." };
  }
  if (durationMinutes !== null && (!Number.isFinite(durationMinutes) || durationMinutes <= 0)) {
    return { ok: false, error: "Durasi harus berupa angka > 0 (menit) atau dikosongkan." };
  }

  const supabase = await getSupabaseServerClient("write");

  // Check if slug already exists (exclude current category)
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .neq("id", id)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: `Slug "${slug}" sudah digunakan. Pilih slug lain.` };
  }

  // Prevent circular reference (parent cannot be self or descendant)
  if (parentId === id) {
    return { ok: false, error: "Kategori tidak bisa menjadi parent dari dirinya sendiri." };
  }

  // Update category
  const { error } = await supabase
    .from("categories")
    .update({
      name,
      slug,
      parent_id: parentId,
      type,
      duration_minutes: durationMinutes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

export async function deleteCategoryWithQuestions(formData: FormData): Promise<void> {
  await requireAdminUser("/admin/categories");

  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  const supabase = await getSupabaseServerClient("write");

  // Get all descendant categories (children, grandchildren, etc)
  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, parent_id");

  const getCategoryDescendants = (categoryId: string, categories: { id: string; parent_id: string | null }[]): string[] => {
    const descendants: string[] = [categoryId];
    const children = categories.filter((c) => c.parent_id === categoryId);
    
    children.forEach((child) => {
      descendants.push(...getCategoryDescendants(child.id, categories));
    });
    
    return descendants;
  };

  const categoryIdsToDelete = allCategories 
    ? getCategoryDescendants(id, allCategories)
    : [id];

  // Delete all questions in these categories (CASCADE DELETE)
  const { error: questionsError } = await supabase
    .from("questions")
    .delete()
    .in("category_id", categoryIdsToDelete);

  if (questionsError) {
    console.error("Error deleting questions:", questionsError);
  }

  // Delete category (will also delete children via CASCADE)
  const { error: categoryError } = await supabase
    .from("categories")
    .delete()
    .eq("id", id);

  if (categoryError) {
    console.error("Error deleting category:", categoryError);
  }

  revalidatePath("/admin/categories");
  revalidatePath("/admin/questions");
  redirect("/admin/categories");
}

export async function getCategoryStats(categoryId: string): Promise<{
  totalQuestions: number;
  childCategories: number;
  totalWithChildren: number;
}> {
  const supabase = await getSupabaseServerClient("read");

  // Get all categories
  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, parent_id");

  // Get descendants
  const getCategoryDescendants = (catId: string, categories: { id: string; parent_id: string | null }[]): string[] => {
    const descendants: string[] = [catId];
    const children = categories.filter((c) => c.parent_id === catId);
    
    children.forEach((child) => {
      descendants.push(...getCategoryDescendants(child.id, categories));
    });
    
    return descendants;
  };

  const allCategoryIds = allCategories 
    ? getCategoryDescendants(categoryId, allCategories)
    : [categoryId];

  // Count questions
  const { count: directCount } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("category_id", categoryId);

  const { count: totalCount } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true })
    .in("category_id", allCategoryIds);

  return {
    totalQuestions: directCount || 0,
    childCategories: allCategoryIds.length - 1,
    totalWithChildren: totalCount || 0,
  };
}
