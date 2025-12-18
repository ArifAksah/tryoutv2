"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type BlueprintActionState = {
  ok: boolean;
  error?: string;
};

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

export async function upsertBlueprint(
  formData: FormData
): Promise<void> {
  await requireAdminUser("/admin/blueprints");

  const institutionId = getString(formData, "institution_id");
  const categoryId = getString(formData, "category_id");
  const questionCount = getInt(formData, "question_count");
  const passingGrade = getInt(formData, "passing_grade");

  if (!institutionId) redirect("/admin/blueprints");
  if (!categoryId) redirect(`/admin/blueprints?institution=${encodeURIComponent(institutionId)}`);
  if (!questionCount || questionCount <= 0) redirect(`/admin/blueprints?institution=${encodeURIComponent(institutionId)}`);
  if (passingGrade !== null && passingGrade < 0) redirect(`/admin/blueprints?institution=${encodeURIComponent(institutionId)}`);

  const supabase = await getSupabaseServerClient("write");
  const { error } = await supabase
    .from("exam_blueprints")
    .upsert(
      {
        institution_id: institutionId,
        category_id: categoryId,
        question_count: questionCount,
        passing_grade: passingGrade,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "institution_id,category_id" }
    );

  if (error) redirect(`/admin/blueprints?institution=${encodeURIComponent(institutionId)}`);

  revalidatePath("/admin/blueprints");
  redirect(`/admin/blueprints?institution=${encodeURIComponent(institutionId)}`);
}

export async function deleteBlueprint(formData: FormData): Promise<void> {
  await requireAdminUser("/admin/blueprints");

  const id = getString(formData, "id");
  const institutionId = getString(formData, "institution_id");

  if (!id) redirect("/admin/blueprints");

  const supabase = await getSupabaseServerClient("write");
  await supabase.from("exam_blueprints").delete().eq("id", id);

  revalidatePath("/admin/blueprints");
  redirect(`/admin/blueprints${institutionId ? `?institution=${encodeURIComponent(institutionId)}` : ""}`);
}
