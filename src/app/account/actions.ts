"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function getString(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function updateProfile(formData: FormData) {
  const user = await requireUser("/account");

  const usernameRaw = getString(formData, "username");
  const displayNameRaw = getString(formData, "display_name");

  const username = usernameRaw ? usernameRaw.toLowerCase() : null;
  const displayName = displayNameRaw || null;

  if (username && !/^[a-z0-9_]{3,20}$/.test(username)) {
    redirect("/account?error=" + encodeURIComponent("Username harus 3-20 karakter: a-z, 0-9, underscore (_)."));
  }

  const supabase = await getSupabaseServerClient("write");
  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: user.id,
        username,
        display_name: displayName,
      },
      { onConflict: "id" }
    );

  if (error) {
    redirect("/account?error=" + encodeURIComponent(error.message));
  }

  redirect("/account?success=1");
}
