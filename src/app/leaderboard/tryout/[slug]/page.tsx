import Link from "next/link";
import { redirect } from "next/navigation";

import { SidebarShell } from "@/components/sidebar-shell";
import { getCurrentUser, isAdminUser, requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mode?: string }>;
};

type Row = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  best_score: number;
  total_score: number;
  tryout_count: number;
  last_active: string | null;
};

export default async function PackageLeaderboardPage({ params, searchParams }: Props) {
  const me = await requireUser("/leaderboard");
  const user = await getCurrentUser();
  const admin = await isAdminUser();
  const supabase = await getSupabaseServerClient("read");

  const { slug } = await params;
  const sp = await searchParams;
  const modeRaw = String(sp.mode ?? "best").toLowerCase();
  const mode = modeRaw === "total" ? "total" : "best";

  const { data: pkg } = await supabase
    .from("exam_packages")
    .select("id, title, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!pkg) redirect("/leaderboard");

  const { data, error } = await supabase.rpc("get_package_leaderboard", {
    p_package_slug: slug,
    p_mode: mode,
    p_limit: 50,
  });

  const rows = (data ?? []) as Row[];
  const modeLabel = mode === "total" ? "Total Skor" : "Skor Terbaik";

  return (
    <SidebarShell
      title="Leaderboard Paket"
      roleLabel={admin ? "Role: admin" : "Role: user"}
      userEmail={user?.email}
      nav={[
        { href: "/", label: "Dashboard", description: "Kembali" },
        { href: "/account", label: "Akun", description: "Profil" },
        { href: "/leaderboard", label: "Leaderboard", description: "Umum" },
        { href: "/tryout/history", label: "Riwayat Tryout", description: "Review" },
        { href: "/practice/history", label: "Riwayat Latihan", description: "Review" },
        ...(admin ? [{ href: "/admin", label: "Admin", description: "Kelola", variant: "primary" as const }] : []),
        { href: "/logout", label: "Keluar", description: "Sign out", variant: "danger" as const },
      ]}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ranking Paket</p>
          <h1 className="text-2xl font-bold text-slate-900">{pkg.title}</h1>
          <p className="text-sm text-slate-600">
            Mode: <span className="font-semibold text-slate-900">{modeLabel}</span>
          </p>
        </div>

        <form method="GET" className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_240px_220px]">
            <div className="text-sm text-slate-700">
              Paket slug: <span className="font-semibold">{slug}</span>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Urutkan</span>
              <select
                name="mode"
                defaultValue={mode}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              >
                <option value="best">Skor terbaik</option>
                <option value="total">Total skor</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="w-full rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700"
              >
                Terapkan
              </button>
              <Link
                href={`/leaderboard/tryout/${encodeURIComponent(slug)}`}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset
              </Link>
            </div>
          </div>
        </form>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error.message}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
            <p className="font-semibold text-slate-900">Belum ada data leaderboard untuk paket ini.</p>
            <p className="mt-1 text-sm text-slate-600">Masuk ranking setelah submit tryout (status: submitted).</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-[70px_1fr_120px_120px_120px_160px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              <div>#</div>
              <div>User</div>
              <div className="text-right">Best</div>
              <div className="text-right">Total</div>
              <div className="text-right">Tryout</div>
              <div className="text-right">Aktif</div>
            </div>
            <div className="divide-y divide-slate-200">
              {rows.map((r, idx) => {
                const isMe = r.user_id === me.id;
                const name = r.display_name ?? r.username ?? "User";
                const username = r.username ? `@${r.username}` : "";
                const activeLabel = r.last_active ? new Date(r.last_active).toLocaleDateString("id-ID") : "-";

                return (
                  <div
                    key={r.user_id}
                    className={`grid grid-cols-[70px_1fr_120px_120px_120px_160px] items-center gap-3 px-4 py-3 ${
                      isMe ? "bg-sky-50" : ""
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-900">{idx + 1}</div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
                      <div className="truncate text-xs text-slate-500">{username || "-"}</div>
                    </div>
                    <div className="text-right text-sm font-semibold text-slate-900">{r.best_score}</div>
                    <div className="text-right text-sm font-semibold text-slate-900">{r.total_score}</div>
                    <div className="text-right text-sm font-semibold text-slate-900">{r.tryout_count}</div>
                    <div className="text-right text-xs text-slate-600">{activeLabel}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </SidebarShell>
  );
}
