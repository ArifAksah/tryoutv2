import Link from "next/link";

import { SidebarShell } from "@/components/sidebar-shell";
import { RealTryoutRunner } from "@/components/real-tryout-runner";

import { getCurrentUser, isAdminUser, requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import { submitRealTryout } from "../actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

// Support both old column names and new "o_" prefixed column names from fixed SQL functions
type StartRowRaw = {
  // New column names (with o_ prefix)
  o_session_id?: string;
  o_started_at?: string;
  o_duration_minutes?: number;
  o_question_order?: number;
  o_question_id?: string;
  o_topic_slug?: string;
  o_question_text?: string;
  o_question_type?: string;
  o_options?: unknown;
  // Old column names (for backward compatibility)
  session_id?: string;
  started_at?: string;
  duration_minutes?: number;
  question_order?: number;
  question_id?: string;
  topic_slug?: string;
  question_text?: string;
  question_type?: string;
  options?: unknown;
};

type StartRow = {
  session_id: string;
  started_at: string;
  duration_minutes: number;
  question_order: number;
  question_id: string;
  topic_slug: string;
  question_text: string;
  question_type: string;
  options: unknown;
};

// Normalize row to handle both old and new column naming conventions
function normalizeStartRow(raw: StartRowRaw): StartRow {
  return {
    session_id: raw.o_session_id ?? raw.session_id ?? '',
    started_at: raw.o_started_at ?? raw.started_at ?? '',
    duration_minutes: raw.o_duration_minutes ?? raw.duration_minutes ?? 0,
    question_order: raw.o_question_order ?? raw.question_order ?? 0,
    question_id: raw.o_question_id ?? raw.question_id ?? '',
    topic_slug: raw.o_topic_slug ?? raw.topic_slug ?? '',
    question_text: raw.o_question_text ?? raw.question_text ?? '',
    question_type: raw.o_question_type ?? raw.question_type ?? '',
    options: raw.o_options ?? raw.options ?? [],
  };
}

function normalizeOptions(value: unknown): Array<{ key: string; text: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as { key?: unknown; id?: unknown; text?: unknown };
      const rawKey = typeof obj.key === "string" ? obj.key : typeof obj.id === "string" ? obj.id : undefined;
      if (typeof rawKey !== "string" || typeof obj.text !== "string") return null;
      return { key: rawKey.toUpperCase(), text: obj.text };
    })
    .filter((x): x is { key: string; text: string } => x !== null);
}

export default async function RealTryoutPage({ params }: Props) {
  const { id } = await params;

  const safeDecode = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const decodedId = safeDecode(id);
  await requireUser(`/tryout/real/${encodeURIComponent(decodedId)}`);

  const user = await getCurrentUser();
  const admin = await isAdminUser();
  // Server Components cannot modify cookies; use read-mode client here.
  const supabase = await getSupabaseServerClient("read");

  const target = decodedId.trim();
  const institutionCode = target.toUpperCase();

  const { data: institution } = await supabase
    .from("institutions")
    .select("code")
    .eq("code", institutionCode)
    .maybeSingle();

  const slug = target.toLowerCase();
  const { data: tryoutPackage } = await supabase
    .from("exam_packages")
    .select("id, slug, title")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  let rows: StartRow[] = [];
  let modeLabel = "";

  if (institution) {
    modeLabel = `SKB ${institution.code}`;
    const { data, error } = await supabase.rpc("start_institution_tryout", {
      p_duration_minutes: 60,
      p_institution_code: institution.code,
    });

    if (error) {
      return (
        <SidebarShell
          title="Tryout Real"
          roleLabel={admin ? "Role: admin" : "Role: user"}
          userEmail={user?.email}
          nav={[
            { href: "/", label: "Dashboard", description: "Kembali" },
            { href: "/account", label: "Akun", description: "Profil" },
            { href: "/leaderboard", label: "Leaderboard", description: "Ranking" },
            { href: "/tryout/history", label: "Riwayat Tryout", description: "Review" },
            { href: "/practice/history", label: "Riwayat Latihan", description: "Review" },
            { href: "/admin", label: "Admin", description: "Bank soal", variant: "primary" },
            { href: "/logout", label: "Sign out", description: "Keluar", variant: "danger" },
          ]}
        >
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-slate-900">Tryout Real</h1>
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Gagal memulai tryout: {error.message}
            </div>
            <Link
              href={`/sections/${encodeURIComponent(target.toLowerCase())}`}
              className="inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kembali
            </Link>
          </div>
        </SidebarShell>
      );
    }

    rows = ((data ?? []) as StartRowRaw[]).map(normalizeStartRow);
  } else {
    if (tryoutPackage) {
      // Check Access Control
      const { checkPackageAccess } = await import("@/lib/subscription");
      const access = await checkPackageAccess(user?.id, tryoutPackage.id);

      if (!access.allowed) {
        return (
          <SidebarShell
            title="Akses Ditolak"
            roleLabel={admin ? "Role: admin" : "Role: user"}
            userEmail={user?.email}
            nav={[
              { href: "/", label: "Dashboard", description: "Kembali" },
              { href: "/pricing", label: "Langganan", description: "Beli Paket", variant: "primary" },
            ]}
          >
            <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 text-4xl">🔒</div>
              <h1 className="mb-2 text-2xl font-bold text-slate-900">Konten Terkunci</h1>
              <p className="mb-6 max-w-md text-slate-600">
                Maaf, paket tryout <strong>"{tryoutPackage.title}"</strong> hanya tersedia untuk member berlangganan paket tertentu.
              </p>
              <Link
                href="/pricing"
                className="rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 active:scale-95"
              >
                Lihat Paket Langganan 💎
              </Link>
            </div>
          </SidebarShell>
        );
      }

      modeLabel = `Tryout ${tryoutPackage.title}`;
      const { data, error } = await supabase.rpc("start_package_tryout", {
        p_package_slug: slug,
      });

      if (error) {
        return (
          <SidebarShell
            title="Tryout Real"
            roleLabel={admin ? "Role: admin" : "Role: user"}
            userEmail={user?.email}
            nav={[
              { href: "/", label: "Dashboard", description: "Kembali" },
              { href: "/account", label: "Akun", description: "Profil" },
              { href: "/leaderboard", label: "Leaderboard", description: "Ranking" },
              { href: "/tryout/history", label: "Riwayat Tryout", description: "Review" },
              { href: "/practice/history", label: "Riwayat Latihan", description: "Review" },
              { href: "/admin", label: "Admin", description: "Bank soal", variant: "primary" },
              { href: "/logout", label: "Sign out", description: "Keluar", variant: "danger" },
            ]}
          >
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-slate-900">Tryout Real</h1>
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Gagal memulai tryout: {error.message}
              </div>
              <Link
                href={`/`}
                className="inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Kembali
              </Link>
            </div>
          </SidebarShell>
        );
      }

      rows = ((data ?? []) as StartRowRaw[]).map(normalizeStartRow);
    } else {
      modeLabel = slug === "skd" ? "SKD (TWK + TIU + TKP)" : `SKD ${target}`;

      const { data, error } =
        slug === "skd"
          ? await supabase.rpc("start_skd_tryout", {
            p_duration_minutes: 100,
            p_take_tiu: 35,
            p_take_tkp: 45,
            p_take_twk: 30,
          })
          : await supabase.rpc("start_category_tryout", {
            p_category_slug: slug,
            p_take: 30,
          });

      if (error) {
        return (
          <SidebarShell
            title="Tryout Real"
            roleLabel={admin ? "Role: admin" : "Role: user"}
            userEmail={user?.email}
            nav={[
              { href: "/", label: "Dashboard", description: "Kembali" },
              { href: "/account", label: "Akun", description: "Profil" },
              { href: "/leaderboard", label: "Leaderboard", description: "Ranking" },
              { href: "/tryout/history", label: "Riwayat Tryout", description: "Review" },
              { href: "/practice/history", label: "Riwayat Latihan", description: "Review" },
              { href: "/admin", label: "Admin", description: "Bank soal", variant: "primary" },
              { href: "/logout", label: "Sign out", description: "Keluar", variant: "danger" },
            ]}
          >
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-slate-900">Tryout Real</h1>
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Gagal memulai tryout: {error.message}
              </div>
              <Link
                href={`/sections/${encodeURIComponent(target.toLowerCase())}`}
                className="inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Kembali
              </Link>
            </div>
          </SidebarShell>
        );
      }

      rows = ((data ?? []) as StartRowRaw[]).map(normalizeStartRow);
    }
  }

  const sessionId = rows[0]?.session_id ?? "";
  const startedAt = rows[0]?.started_at ?? new Date().toISOString();
  const durationMinutes = rows[0]?.duration_minutes ?? 30;

  type SessionRow = {
    id: string;
    package_id: string;
    started_at: string;
    finished_at: string | null;
    score_total: number | null;
    status: string;
  };

  let attemptNumber: number | null = null;
  let recentAttempts: Array<Omit<SessionRow, "package_id">> = [];

  if (sessionId) {
    const { data: currentSession } = await supabase
      .from("user_exam_sessions")
      .select("id, package_id, started_at, finished_at, score_total, status")
      .eq("id", sessionId)
      .maybeSingle();

    const current = currentSession as SessionRow | null;
    if (current?.package_id) {
      const { count } = await supabase
        .from("user_exam_sessions")
        .select("id", { count: "exact", head: true })
        .eq("package_id", current.package_id);

      attemptNumber = count ?? null;

      const { data: recent } = await supabase
        .from("user_exam_sessions")
        .select("id, started_at, finished_at, score_total, status")
        .eq("package_id", current.package_id)
        .order("started_at", { ascending: false })
        .limit(10);

      recentAttempts = (recent ?? []) as Array<Omit<SessionRow, "package_id">>;
    }
  }
  const questions = rows
    .sort((a, b) => a.question_order - b.question_order)
    .map((row) => ({
      id: row.question_id,
      topicSlug: row.topic_slug,
      questionText: row.question_text,
      questionType: (row.question_type === "scale_tkp" ? "scale_tkp" : "multiple_choice") as
        | "multiple_choice"
        | "scale_tkp",
      options: normalizeOptions(row.options),
    }));

  if (questions.length > 0) {
    console.log("[DEBUG] Tryout Questions Sample:", JSON.stringify(questions.slice(0, 3), null, 2));
    console.log("[DEBUG] First Question Options Raw:", JSON.stringify(rows[0]?.options, null, 2));
  }


  return (
    <SidebarShell
      title="Tryout Real"
      roleLabel={admin ? "Role: admin" : "Role: user"}
      userEmail={user?.email}
      nav={[
        { href: "/", label: "Dashboard", description: "Kembali" },
        { href: `/sections/${encodeURIComponent(target.toLowerCase())}`, label: "Modul", description: "Detail" },
        { href: "/account", label: "Akun", description: "Profil" },
        { href: "/leaderboard", label: "Leaderboard", description: "Ranking" },
        { href: "/tryout/history", label: "Riwayat Tryout", description: "Review" },
        { href: "/practice/history", label: "Riwayat Latihan", description: "Review" },
        { href: "/admin", label: "Admin", description: "Bank soal", variant: "primary" },
        { href: "/logout", label: "Sign out", description: "Keluar", variant: "danger" },
      ]}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{modeLabel}</p>
          <h1 className="text-2xl font-bold text-slate-900">Tryout Real (Timer)</h1>
          <p className="text-sm text-slate-700">
            Total soal: <span className="font-semibold text-slate-900">{questions.length}</span>
          </p>
        </div>

        {attemptNumber ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Riwayat Pengerjaan</p>
            <p className="mt-1 text-xs text-slate-600">
              Percobaan ke-<span className="font-semibold">{attemptNumber}</span>
              {recentAttempts.length > 0 ? " · Menampilkan 10 percobaan terakhir" : ""}
            </p>

            {recentAttempts.length > 0 ? (
              <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                <div className="grid grid-cols-[120px_1fr_120px_120px] gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  <div>Percobaan</div>
                  <div>Waktu</div>
                  <div>Status</div>
                  <div className="text-right">Skor</div>
                </div>
                <div className="divide-y divide-slate-200">
                  {recentAttempts.map((s, idx) => {
                    const num = attemptNumber - idx;
                    const isCurrent = s.id === sessionId;
                    const startLabel = s.started_at ? new Date(s.started_at).toLocaleString("id-ID") : "-";
                    const finishLabel = s.finished_at ? new Date(s.finished_at).toLocaleString("id-ID") : "(belum selesai)";
                    const scoreLabel = typeof s.score_total === "number" ? String(s.score_total) : "-";
                    return (
                      <div
                        key={s.id}
                        className={`grid grid-cols-[120px_1fr_120px_120px] gap-3 px-4 py-2 text-sm ${isCurrent ? "bg-sky-50" : "bg-white"
                          }`}
                      >
                        <div className="text-slate-700">
                          <span className={`font-semibold ${isCurrent ? "text-sky-700" : "text-slate-900"}`}>
                            #{num}
                          </span>
                          {isCurrent ? <span className="ml-2 text-xs text-sky-700">(sekarang)</span> : null}
                        </div>
                        <div className="text-xs text-slate-600">
                          <div>Mulai: {startLabel}</div>
                          <div>Selesai: {finishLabel}</div>
                        </div>
                        <div className="text-xs text-slate-600">{s.status}</div>
                        <div className="text-right text-sm font-semibold text-slate-900">{scoreLabel}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <RealTryoutRunner
          sessionId={sessionId}
          startedAt={startedAt}
          durationMinutes={durationMinutes}
          questions={questions}
          submitAction={submitRealTryout}
        />
      </div>
    </SidebarShell>
  );
}
