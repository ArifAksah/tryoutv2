import "server-only";

import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_COOKIE_NAME = "tryout_admin_session";
const ADMIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12; // 12h

function getAdminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD;
  if (!value) return null;
  return value;
}

function computeSessionValue(password: string): string {
  return createHash("sha256").update(`tryout-admin|${password}`).digest("hex");
}

export function isAdminConfigured(): boolean {
  return Boolean(getAdminPassword());
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const password = getAdminPassword();
  if (!password) return false;

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!sessionCookie) return false;

  const expected = computeSessionValue(password);

  try {
    const a = Buffer.from(sessionCookie);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function requireAdmin(): Promise<void> {
  if (!isAdminConfigured()) {
    redirect("/admin?error=not_configured");
  }

  const authed = await isAdminAuthenticated();
  if (!authed) {
    redirect("/admin");
  }
}

export async function setAdminSessionCookie(): Promise<void> {
  const password = getAdminPassword();
  if (!password) {
    redirect("/admin?error=not_configured");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, computeSessionValue(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}
