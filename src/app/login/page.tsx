import Link from "next/link";

import { LoginClient } from "./login-client";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ next?: string; error?: string; error_description?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next, error, error_description } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/";

  const user = await getCurrentUser();
  if (user) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">Kamu sudah login</h1>
            <p className="text-sm text-slate-700">
              {user.email ? (
                <>
                  Login sebagai <span className="font-semibold text-slate-900">{user.email}</span>.
                </>
              ) : (
                "Sesi login kamu masih aktif."
              )}
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
            <Link
              href={nextPath}
              className="block w-full rounded-lg border border-emerald-600 px-4 py-2 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Lanjut ke aplikasi
            </Link>
            <Link
              href="/logout"
              className="block w-full rounded-lg border border-rose-500 px-4 py-2 text-center text-sm font-semibold text-rose-600 hover:bg-rose-50"
            >
              Sign out
            </Link>
            <p className="text-xs text-slate-500">
              Tombol Sign out akan menghapus sesi Supabase (cookie) dan mengarahkan kembali ke halaman login.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Login</h1>
          <p className="text-sm text-slate-700">
            Untuk mulai tryout, kamu perlu login terlebih dulu.
          </p>
        </div>

        <LoginClient
          nextPath={nextPath}
          initialError={
            error_description
              ? decodeURIComponent(error_description)
              : error
              ? `Login error: ${error}`
              : null
          }
        />

        <p className="text-xs text-slate-500">
          Admin juga menggunakan akun Supabase yang sama. Role admin ditentukan dari tabel <span className="font-semibold text-slate-700">admin_users</span>.
        </p>
      </main>
    </div>
  );
}
