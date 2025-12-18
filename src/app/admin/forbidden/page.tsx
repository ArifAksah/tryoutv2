import Link from "next/link";

import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminForbiddenPage() {
  await requireUser("/admin");

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Akses ditolak</h1>
      <p className="text-sm text-slate-700">
        Akun kamu belum memiliki role admin. Minta admin untuk menambahkan <span className="font-semibold text-slate-900">user_id</span> kamu ke tabel
        <span className="font-semibold text-slate-900"> admin_users</span> di Supabase.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-lg border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Kembali
        </Link>
        <Link
          href="/logout"
          className="rounded-lg border border-rose-300 px-5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
        >
          Logout
        </Link>
      </div>
    </div>
  );
}
