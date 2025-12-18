import Link from "next/link";
import { redirect } from "next/navigation";

import { SidebarShell } from "@/components/sidebar-shell";
import { getCurrentUser, isAdminUser, requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ root?: string; section?: string; sort?: string; q?: string }>;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  type: string | null;
};

export default async function PracticeHistoryGlobalPage({ searchParams }: Props) {
  await requireUser("/practice/history");
  const user = await getCurrentUser();
  const admin = await isAdminUser();
  const supabase = await getSupabaseServerClient("read");

  if (!user?.id) redirect("/login");

  const sp = await searchParams;
  const rootFilterRaw = (sp.root ?? "all").toLowerCase();
  const sectionFilterRaw = (sp.section ?? "all").toLowerCase();
  const sortRaw = (sp.sort ?? "recent").toLowerCase();
  const qRaw = String(sp.q ?? "").trim();
  const q = qRaw.toLowerCase();

  const rootFilter = rootFilterRaw === "skd" || rootFilterRaw === "skb" ? rootFilterRaw : "all";
  const sectionFilter =
    sectionFilterRaw === "twk" || sectionFilterRaw === "tiu" || sectionFilterRaw === "tkp"
      ? sectionFilterRaw
      : "all";
  const sort = sortRaw === "best" ? "best" : "recent";

  // Fetch a larger slice so filters/sorting feel useful.
  const { data: sessionsData } = await supabase
    .from("user_practice_sessions")
    .select("id, category_id, take_count, score_total, max_score, correct_count, total_questions, started_at, finished_at")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(500);

  const { data: categoriesData } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, type");

  const categoryById = new Map<string, CategoryRow>();
  (categoriesData ?? []).forEach((c) => {
    const row = c as CategoryRow;
    if (row?.id) categoryById.set(row.id, row);
  });

  const getRootSlug = (categoryId: string): string => {
    const visited = new Set<string>();
    let cur = categoryById.get(categoryId);
    while (cur?.parent_id) {
      if (visited.has(cur.id)) break;
      visited.add(cur.id);
      cur = categoryById.get(cur.parent_id);
    }
    return cur?.slug ?? "unknown";
  };

  const getSectionSlug = (categoryId: string): string => {
    const visited = new Set<string>();
    let cur = categoryById.get(categoryId);
    while (cur) {
      if (visited.has(cur.id)) break;
      visited.add(cur.id);

      if (cur.type === "topic") return cur.slug;
      if (!cur.parent_id) break;
      cur = categoryById.get(cur.parent_id);
    }
    return "unknown";
  };

  const sessions = ((sessionsData ?? []) as Array<{
    id: string;
    category_id: string;
    take_count: number;
    score_total: number;
    max_score: number;
    correct_count: number;
    total_questions: number;
    started_at: string;
    finished_at: string | null;
  }>).
    map((s) => {
      const cat = categoryById.get(s.category_id) ?? null;
      const root = getRootSlug(s.category_id);
      const section = getSectionSlug(s.category_id);
      const pct = s.max_score > 0 ? s.score_total / s.max_score : 0;
      return {
        ...s,
        categoryName: cat?.name ?? "(unknown)",
        categorySlug: cat?.slug ?? "",
        rootSlug: root,
        sectionSlug: section,
        pct,
      };
    });

  const filtered = sessions.filter((s) => {
    if (rootFilter !== "all" && s.rootSlug !== rootFilter) return false;
    if (sectionFilter !== "all" && s.sectionSlug !== sectionFilter) return false;
    if (q) {
      const hay = `${s.categoryName} ${s.categorySlug}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "best") {
      if (b.pct !== a.pct) return b.pct - a.pct;
      if (b.score_total !== a.score_total) return b.score_total - a.score_total;
      return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
    }
    return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
  });

  const visible = sorted.slice(0, 50);

  // Attempt numbering within the fetched window (chronological per category)
  const attemptBySessionId = new Map<string, number>();
  const countsByCategory = new Map<string, number>();
  const chronological = [...sorted].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );
  chronological.forEach((s) => {
    const prev = countsByCategory.get(s.category_id) ?? 0;
    const next = prev + 1;
    countsByCategory.set(s.category_id, next);
    attemptBySessionId.set(s.id, next);
  });

  return (
    <SidebarShell
      title="Riwayat Latihan"
      roleLabel={admin ? "Role: admin" : "Role: user"}
      userEmail={user.email}
      nav={[
        { href: "/", label: "Dashboard", description: "Kembali" },
        { href: "/account", label: "Akun", description: "Profil" },
        { href: "/leaderboard", label: "Leaderboard", description: "Ranking" },
        { href: "/practice/history", label: "Riwayat Latihan", description: "Review" },
        { href: "/tryout/history", label: "Riwayat Tryout", description: "Review" },
        ...(admin ? [{ href: "/admin", label: "Admin", description: "Kelola", variant: "primary" as const }] : []),
        { href: "/logout", label: "Keluar", description: "Sign out", variant: "danger" as const },
      ]}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">History</p>
          <h1 className="text-2xl font-bold text-slate-900">Riwayat Latihan (Semua Topik)</h1>
          <p className="text-sm text-slate-600">Klik “Review” untuk lihat jawaban & pembahasan.</p>
        </div>

        <form method="GET" className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-5">
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Root</span>
              <select
                name="root"
                defaultValue={rootFilter}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              >
                <option value="all">Semua</option>
                <option value="skd">SKD</option>
                <option value="skb">SKB</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Section</span>
              <select
                name="section"
                defaultValue={sectionFilter}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              >
                <option value="all">Semua</option>
                <option value="twk">TWK</option>
                <option value="tiu">TIU</option>
                <option value="tkp">TKP</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Urutkan</span>
              <select
                name="sort"
                defaultValue={sort}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              >
                <option value="recent">Terbaru</option>
                <option value="best">Skor tertinggi</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cari</span>
              <input
                name="q"
                defaultValue={qRaw}
                placeholder="contoh: analogi / tiu"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400"
              />
            </label>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700"
              >
                Terapkan
              </button>
              <Link
                href="/practice/history"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset
              </Link>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Menampilkan <span className="font-semibold text-slate-700">{visible.length}</span> dari{" "}
            <span className="font-semibold text-slate-700">{filtered.length}</span> hasil (data yang di-load: {sessions.length}).
          </p>
        </form>

        {visible.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
            <p className="font-semibold text-slate-900">Belum ada riwayat latihan.</p>
            <Link
              href="/"
              className="mt-4 inline-flex rounded-lg bg-sky-600 px-5 py-2.5 font-semibold text-white hover:bg-sky-700"
            >
              Mulai Latihan
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-[140px_1fr_120px_120px_140px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              <div>Percobaan</div>
              <div>Topik</div>
              <div className="text-right">Benar</div>
              <div className="text-right">Skor</div>
              <div className="text-right">Aksi</div>
            </div>
            <div className="divide-y divide-slate-200">
              {visible.map((s) => {
                const slug = s.categorySlug;
                const name = s.categoryName;
                const attempt = attemptBySessionId.get(s.id) ?? 1;

                return (
                  <div
                    key={s.id}
                    className="grid grid-cols-[140px_1fr_120px_120px_140px] items-center gap-3 px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-slate-900">#{attempt}</div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
                      <div className="truncate text-xs text-slate-500">
                        <span className="font-semibold">{slug || "(unknown)"}</span>
                        {" "}·{" "}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {s.sectionSlug.toUpperCase()}
                        </span>
                        {" "}·{" "}
                        {new Date(s.started_at).toLocaleString("id-ID")}
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold text-slate-900">
                      {s.correct_count}/{s.total_questions}
                    </div>
                    <div className="text-right text-sm font-semibold text-slate-900">
                      {s.score_total}/{s.max_score}
                    </div>
                    <div className="text-right">
                      {slug ? (
                        <Link
                          href={`/practice/${encodeURIComponent(slug)}/history/${s.id}`}
                          className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Review
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </div>
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
