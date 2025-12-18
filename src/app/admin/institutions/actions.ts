"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type InstitutionActionState = {
  ok: boolean;
  error?: string;
};

function getString(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function upsertInstitution(
  formData: FormData
): Promise<void> {
  await requireAdminUser("/admin/institutions");

  const code = getString(formData, "code").toUpperCase();
  const name = getString(formData, "name");
  const logoUrl = getString(formData, "logo_url") || null;

  if (!code) redirect("/admin/institutions");
  if (!/^[A-Z0-9_-]{2,20}$/.test(code)) {
    redirect("/admin/institutions");
  }
  if (!name) redirect("/admin/institutions");

  const supabase = await getSupabaseServerClient("write");
  const { error } = await supabase
    .from("institutions")
    .upsert(
      {
        code,
        name,
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "code" }
    );

  if (error) redirect("/admin/institutions");

  revalidatePath("/admin/institutions");
  redirect("/admin/institutions");
}

export async function updateInstitution(
  formData: FormData
): Promise<void> {
  await requireAdminUser("/admin/institutions");

  const id = getString(formData, "id");
  const name = getString(formData, "name");
  const logoUrl = getString(formData, "logo_url") || null;

  if (!id) redirect("/admin/institutions");
  if (!name) redirect("/admin/institutions");

  const supabase = await getSupabaseServerClient("write");
  const { error } = await supabase
    .from("institutions")
    .update({
      name,
      logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) redirect("/admin/institutions");

  revalidatePath("/admin/institutions");
  redirect("/admin/institutions");
}

export async function deleteInstitution(formData: FormData): Promise<void> {
  await requireAdminUser("/admin/institutions");

  const id = getString(formData, "id");
  if (!id) redirect("/admin/institutions");

  const supabase = await getSupabaseServerClient("write");
  await supabase.from("institutions").delete().eq("id", id);

  revalidatePath("/admin/institutions");
  redirect("/admin/institutions");
}
