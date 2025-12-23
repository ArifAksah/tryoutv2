"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function getString(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function getInt(formData: FormData, name: string): number | null {
  const raw = getString(formData, name);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.trunc(value);
}

export async function upsertBlueprint(formData: FormData): Promise<void> {
  await requireAdminUser("/admin/blueprints");

  const institutionId = getString(formData, "institution_id");
  const categoryId = getString(formData, "category_id");
  const questionCount = getInt(formData, "question_count");
  const passingGrade = getInt(formData, "passing_grade");

  if (!institutionId || !categoryId) redirect("/admin/blueprints");
  // Allow passing grade to be null

  const supabase = await getSupabaseServerClient("write");
  const { error } = await supabase
    .from("exam_blueprints")
    .upsert(
      {
        institution_id: institutionId,
        category_id: categoryId,
        question_count: questionCount || 0,
        passing_grade: passingGrade,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "institution_id,category_id" }
    );

  if (error) redirect(`/admin/blueprints?institution=${institutionId}&error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/blueprints");
  redirect(`/admin/blueprints?institution=${institutionId}`);
}

export async function deleteBlueprint(formData: FormData): Promise<void> {
  await requireAdminUser("/admin/blueprints");

  const id = getString(formData, "id");
  const institutionId = getString(formData, "institution_id");
  if (!id) redirect("/admin/blueprints");

  const supabase = await getSupabaseServerClient("write");
  await supabase.from("exam_blueprints").delete().eq("id", id);

  revalidatePath("/admin/blueprints");
  redirect(`/admin/blueprints${institutionId ? `?institution=${institutionId}` : ""}`);
}

export async function enableSubjectSupport(formData: FormData): Promise<void> {
  await requireAdminUser("/admin/blueprints");

  const code = getString(formData, "code").toUpperCase();
  const name = getString(formData, "name");

  if (!code || !name) redirect("/admin/blueprints");

  const supabase = await getSupabaseServerClient("write");

  // Check if institution already exists
  const { data: existing } = await supabase
    .from("institutions")
    .select("id")
    .eq("code", code)
    .maybeSingle();

  let institutionId = existing?.id;

  if (!institutionId) {
    const { data, error } = await supabase
      .from("institutions")
      .insert({ code, name })
      .select("id")
      .single();

    if (error || !data) redirect(`/admin/blueprints?error=${encodeURIComponent(error?.message || "Failed to create subject support")}`);
    institutionId = data.id;
  }

  revalidatePath("/admin/blueprints");
  redirect(`/admin/blueprints?institution=${institutionId}`);
}

export async function enableUtbkSupport(): Promise<void> {
  // Alias for backward compatibility or direct button call
  const fd = new FormData();
  fd.append("code", "UTBK");
  fd.append("name", "UTBK SNBT");
  return enableSubjectSupport(fd);
}

export async function saveBlueprintSchema(formData: FormData): Promise<void> {
  await requireAdminUser("/admin/blueprints");

  const institutionId = getString(formData, "institution_id");
  const schemaJson = getString(formData, "schema_json");

  if (!institutionId || !schemaJson) redirect("/admin/blueprints");

  type SchemaItem = { category_id: string; question_count: number; passing_grade: number | null };
  let items: SchemaItem[] = [];
  try {
    items = JSON.parse(schemaJson);
  } catch (e) {
    redirect(`/admin/blueprints?institution=${institutionId}&error=${encodeURIComponent("Invalid schema JSON")}`);
  }

  const supabase = await getSupabaseServerClient("write");

  // 1. Delete existing for this institution
  // Safe because we are replacing the entire 'active' set.
  // BUT: If the user didn't mean to delete everything, this is risky.
  // However, the UI loads the EXISTING set first.
  // So 'items' contains (Previous State + Edits).
  // Thus, it represents the NEW Full State.
  // Anything not in 'items' (suspended/zeroed) is implicitly deleted.
  await supabase.from("exam_blueprints").delete().eq("institution_id", institutionId);

  if (items.length > 0) {
    const rows = items.map(item => ({
      institution_id: institutionId,
      category_id: item.category_id,
      question_count: item.question_count,
      passing_grade: item.passing_grade,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase.from("exam_blueprints").insert(rows);
    if (error) redirect(`/admin/blueprints?institution=${institutionId}&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/blueprints");
  redirect(`/admin/blueprints?institution=${institutionId}`);
}
