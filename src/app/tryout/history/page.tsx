import Link from "next/link";

import { SidebarShell } from "@/components/sidebar-shell";
import { getCurrentUser, isAdminUser, requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function TryoutHistoryPage({ searchParams }: Props) {
  await requireUser("/tryout/history");
  const user = await getCurrentUser();
  const admin = await isAdminUser();
  const supabase = await getSupabaseServerClient("read");

  const sp = await searchParams;
  const pageRaw = Number.parseInt(String(sp.page ?? "1"), 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const perPage = 10;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, count } = await supabase
    .from("user_exam_sessions")
    .select(
      "id, package_id, score_total, status, started_at, finished_at, exam_packages(title, slug, duration_minutes)",
      { count: "exact" }
    )
    .eq("user_id", user?.id ?? "")
    .order("started_at", { ascending: false })
    .range(from, to);

  const sessions = (data ?? []) as Array<{
    id: string;
    package_id: string;
    score_total: number | null;
    status: string;
    started_at: string;
    finished_at: string | null;
    exam_packages?:
      | { title?: string | null; slug?: string | null; duration_minutes?: number | null }
      | Array<{ title?: string | null; slug?: string | null; duration_minutes?: number | null }>
      | null;
  }>;

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // Attempt number per package (accurate even with pagination)
  const attemptBySessionId = new Map<string, number>();

  const packageIds = Array.from(new Set(sessions.map((s) => s.package_id).filter(Boolean)));
  if (user?.id && packageIds.length > 0) {
    const { data: allForPackages } = await supabase
      .from("user_exam_sessions")
      .select("id, package_id, started_at")
      .eq("user_id", user.id)
      .in("package_id", packageIds)
      .order("started_at", { ascending: true });

    const countsByPackage = new Map<string, number>();
    (allForPackages ?? []).forEach((row) => {
      const pkgId = (row as { package_id?: string }).package_id;
      const sessionId = (row as { id?: string }).id;
      if (!pkgId || !sessionId) return;
      const prev = countsByPackage.get(pkgId) ?? 0;
      const next = prev + 1;
      countsByPackage.set(pkgId, next);
      attemptBySessionId.set(sessionId, next);
    });
  }

  return (
    <SidebarShell
      title="Riwayat Tryout"
      roleLabel={admin ? "Role: admin" : "Role: user"}
      userEmail={user?.email}
      nav={[
        { href: "/", label: "Dashboard", description: "Kembali" },
        { href: "/account", label: "Akun", description: "Profil" },
        { href: "/leaderboard", label: "Leaderboard", description: "Ranking" },
        { href: "/tryout/history", label: "Riwayat Tryout", description: "Review" },
        { href: "/practice/history", label: "Riwayat Latihan", description: "Review" },
        { href: admin ? "/admin" : "/", label: "Admin", description: "Bank soal", variant: admin ? "primary" : "default" },
        { href: "/logout", label: "Sign out", description: "Keluar", variant: "danger" },
      ]}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">History</p>
          <h1 className="text-2xl font-bold text-slate-900">Riwayat Tryout</h1>
          <p className="text-sm text-slate-600">Klik “Review” untuk melihat jawaban, pembahasan, dan skor.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm text-slate-700">
            Halaman <span className="font-semibold">{page}</span> dari <span className="font-semibold">{totalPages}</span>
            {total ? (
              <>
                {" "}· Total <span className="font-semibold">{total}</span> sesi
              </>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/tryout/history?page=${Math.max(1, page - 1)}`}
              aria-disabled={page <= 1}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                page <= 1
                  ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Prev
            </Link>
            <Link
              href={`/tryout/history?page=${Math.min(totalPages, page + 1)}`}
              aria-disabled={page >= totalPages}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                page >= totalPages
                  ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Next
            </Link>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
            <p className="font-semibold text-slate-900">Belum ada riwayat tryout.</p>
            <Link
              href="/"
              className="mt-4 inline-flex rounded-lg bg-sky-600 px-5 py-2.5 font-semibold text-white hover:bg-sky-700"
            >
              Mulai Tryout
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-[140px_1fr_120px_120px_140px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              <div>Percobaan</div>
              <div>Paket</div>
              <div>Status</div>
              <div className="text-right">Skor</div>
              <div className="text-right">Aksi</div>
            </div>
            <div className="divide-y divide-slate-200">
              {sessions.map((s) => {
                const attempt = attemptBySessionId.get(s.id) ?? 1;
                const pkg = Array.isArray(s.exam_packages) ? s.exam_packages[0] : s.exam_packages;
                const pkgTitle = pkg?.title ?? "Tryout";
                const pkgSlug = pkg?.slug ?? "";
                const scoreLabel = typeof s.score_total === "number" ? String(s.score_total) : "-";

                return (
                  <div
                    key={s.id}
                    className="grid grid-cols-[140px_1fr_120px_120px_140px] items-center gap-3 px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-slate-900">#{attempt}</div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{pkgTitle}</div>
                      <div className="truncate text-xs text-slate-500">
                        {pkgSlug ? <span className="font-semibold">{pkgSlug}</span> : null}
                        {s.started_at ? ` · ${new Date(s.started_at).toLocaleString("id-ID")}` : null}
                      </div>
                    </div>
                    <div className="text-xs text-slate-700">{s.status}</div>
                    <div className="text-right text-sm font-semibold text-slate-900">{scoreLabel}</div>
                    <div className="text-right">
                      <Link
                        href={`/tryout/history/${s.id}`}
                        className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-end gap-2">
            <Link
              href={`/tryout/history?page=${Math.max(1, page - 1)}`}
              aria-disabled={page <= 1}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                page <= 1
                  ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Prev
            </Link>
            <Link
              href={`/tryout/history?page=${Math.min(totalPages, page + 1)}`}
              aria-disabled={page >= totalPages}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                page >= totalPages
                  ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Next
            </Link>
          </div>
        ) : null}
      </div>
    </SidebarShell>
  );
}
