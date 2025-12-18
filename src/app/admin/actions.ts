"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSessionCookie,
  isAdminConfigured,
  setAdminSessionCookie,
} from "@/lib/admin-auth";

export async function loginAdmin(formData: FormData): Promise<void> {
  if (!isAdminConfigured()) {
    redirect("/admin?error=not_configured");
  }

  const submitted = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD ?? "";

  if (!submitted || submitted !== expected) {
    redirect("/admin?error=invalid_password");
  }

  await setAdminSessionCookie();
  redirect("/admin/questions");
}

export async function logoutAdmin(): Promise<void> {
  await clearAdminSessionCookie();
  redirect("/admin");
}
