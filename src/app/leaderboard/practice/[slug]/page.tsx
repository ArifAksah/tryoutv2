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
  best_max_score: number;
  best_pct: number;
  total_score: number;
  total_max_score: number;
  session_count: number;
  last_active: string | null;
};

function pctLabel(pct: number): string {
  if (!Number.isFinite(pct)) return "0%";
  return `${Math.round(pct * 100)}%`;
}

export default async function PracticeLeaderboardPage({ params, searchParams }: Props) {
  const me = await requireUser("/leaderboard");
  const user = await getCurrentUser();
  const admin = await isAdminUser();
  const supabase = await getSupabaseServerClient("read");

  const { slug } = await params;
  const sp = await searchParams;
  const modeRaw = String(sp.mode ?? "best_pct").toLowerCase();
  const mode = modeRaw === "total" || modeRaw === "best" || modeRaw === "best_pct" ? modeRaw : "best_pct";

  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!category) redirect("/practice/history");

  const { data, error } = await supabase.rpc("get_practice_leaderboard", {
    p_category_slug: slug,
    p_mode: mode,
    p_limit: 50,
  });

  const rows = (data ?? []) as Row[];
  const modeLabel =
    mode === "total" ? "Total Skor" : mode === "best" ? "Skor Terbaik" : "Best %";

  return (
    <SidebarShell
      title="Leaderboard Latihan"
      roleLabel={admin ? "Role: admin" : "Role: user"}
      userEmail={user?.email}
      nav={[
        { href: "/", label: "Dashboard", description: "Kembali" },
        { href: "/account", label: "Akun", description: "Profil" },
        { href: "/leaderboard", label: "Leaderboard", description: "Umum" },
        { href: "/practice/history", label: "Riwayat Latihan", description: "Review" },
        { href: "/tryout/history", label: "Riwayat Tryout", description: "Review" },
        ...(admin ? [{ href: "/admin", label: "Admin", description: "Kelola", variant: "primary" as const }] : []),
        { href: "/logout", label: "Keluar", description: "Sign out", variant: "danger" as const },
      ]}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ranking Latihan</p>
          <h1 className="text-2xl font-bold text-slate-900">{category.name}</h1>
          <p className="text-sm text-slate-600">
            Mode: <span className="font-semibold text-slate-900">{modeLabel}</span>
          </p>
        </div>

        <form method="GET" className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_240px_220px]">
            <div className="text-sm text-slate-700">
              Topik slug: <span className="font-semibold">{slug}</span>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Urutkan</span>
              <select
                name="mode"
                defaultValue={mode}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              >
                <option value="best_pct">Best %</option>
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
                href={`/leaderboard/practice/${encodeURIComponent(slug)}`}
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
            <p className="font-semibold text-slate-900">Belum ada data leaderboard untuk topik ini.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-[70px_1fr_120px_140px_120px_140px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              <div>#</div>
              <div>User</div>
              <div className="text-right">Best %</div>
              <div className="text-right">Best</div>
              <div className="text-right">Total</div>
              <div className="text-right">Latihan</div>
            </div>
            <div className="divide-y divide-slate-200">
              {rows.map((r, idx) => {
                const isMe = r.user_id === me.id;
                const name = r.display_name ?? r.username ?? "User";
                const username = r.username ? `@${r.username}` : "";
                const bestLabel = `${r.best_score}/${r.best_max_score}`;
                const totalLabel = `${r.total_score}/${r.total_max_score}`;

                return (
                  <div
                    key={r.user_id}
                    className={`grid grid-cols-[70px_1fr_120px_140px_120px_140px] items-center gap-3 px-4 py-3 ${
                      isMe ? "bg-sky-50" : ""
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-900">{idx + 1}</div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
                      <div className="truncate text-xs text-slate-500">{username || "-"}</div>
                    </div>
                    <div className="text-right text-sm font-semibold text-slate-900">{pctLabel(r.best_pct)}</div>
                    <div className="text-right text-sm font-semibold text-slate-900">{bestLabel}</div>
                    <div className="text-right text-sm font-semibold text-slate-900">{totalLabel}</div>
                    <div className="text-right text-sm font-semibold text-slate-900">{r.session_count}</div>
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
