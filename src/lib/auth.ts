import "server-only";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  try {
    const supabase = await getSupabaseServerClient("read");
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      // It's normal for a user to not be logged in. 
      // Don't log this as an error to prevent noise/crashes.
      return null;
    }
    return user;
  } catch (error) {
    return null;
  }
}


export async function requireUser(nextPath?: string) {
  const user = await getCurrentUser();
  if (!user) {
    const next = nextPath && nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${next}`);
  }
  return user;
}

export async function isAdminUser(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await getSupabaseServerClient("read");
  const { data } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return Boolean(data);
}

export async function requireAdminUser(nextPath?: string) {
  await requireUser(nextPath);
  const admin = await isAdminUser();
  if (!admin) {
    redirect("/admin/forbidden");
  }
}
