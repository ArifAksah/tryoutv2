import Link from "next/link";
import { redirect } from "next/navigation";

import { SidebarShell } from "@/components/sidebar-shell";
import { MathText } from "@/components/math-text";
import { getCurrentUser, isAdminUser, requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sessionId: string }>;
};

type DbQuestion = {
  id: string;
  question_text: string;
  question_type: "multiple_choice" | "scale_tkp";
  options: unknown;
  answer_key: unknown;
  discussion: string | null;
};

function normalizeOptions(value: unknown): Array<{ key: string; text: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as { key?: unknown; id?: unknown; text?: unknown; value?: unknown };
      const rawKey = typeof obj.key === "string" ? obj.key : typeof obj.id === "string" ? obj.id : undefined;
      const rawText =
        typeof obj.text === "string" ? obj.text : typeof obj.value === "string" ? obj.value : undefined;
      if (!rawKey || !rawText) return null;
      return { key: rawKey.toUpperCase(), text: rawText };
    })
    .filter((x): x is { key: string; text: string } => x !== null);
}

export default async function TryoutHistoryDetailPage({ params }: Props) {
  const { sessionId } = await params;
  await requireUser(`/tryout/history/${sessionId}`);

  const user = await getCurrentUser();
  const admin = await isAdminUser();
  const supabase = await getSupabaseServerClient("read");

  const { data: session } = await supabase
    .from("user_exam_sessions")
    .select(
      "id, user_id, package_id, score_total, status, started_at, finished_at, exam_packages(title, slug, duration_minutes)"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) redirect("/tryout/history");
  if (user?.id && session.user_id !== user.id) redirect("/tryout/history");

  const pkgRow = Array.isArray(session.exam_packages)
    ? session.exam_packages[0]
    : session.exam_packages;
  const pkgTitle = (pkgRow as { title?: string | null } | null)?.title ?? "Tryout";
  const pkgSlug = (pkgRow as { slug?: string | null } | null)?.slug ?? null;
  const startedLabel = session.started_at ? new Date(session.started_at).toLocaleString("id-ID") : "-";
  const finishedLabel = session.finished_at ? new Date(session.finished_at).toLocaleString("id-ID") : "-";

  const { data: ansRows } = await supabase
    .from("user_answers")
    .select("question_id, answer_chosen, score_obtained")
    .eq("session_id", sessionId);

  const answers = (ansRows ?? []) as Array<{
    question_id: string;
    answer_chosen: string | null;
    score_obtained: number | null;
  }>;

  const questionIds = answers.map((a) => a.question_id);

  const { data: qRows } = questionIds.length
    ? await supabase
        .from("questions")
        .select("id, question_text, question_type, options, answer_key, discussion")
        .in("id", questionIds)
    : { data: [] as unknown[] };

  const questionById = new Map(((qRows ?? []) as DbQuestion[]).map((q) => [q.id, q] as const));
  const ordered = answers
    .map((a) => ({ a, q: questionById.get(a.question_id) }))
    .filter((x): x is { a: (typeof answers)[number]; q: DbQuestion } => Boolean(x.q));

  let maxScore = 0;
  let answeredCount = 0;
  let mcCorrect = 0;
  let mcWrong = 0;

  ordered.forEach(({ a, q }) => {
    const chosen = String(a.answer_chosen ?? "").trim().toUpperCase();
    if (chosen) answeredCount += 1;

    const key = (q.answer_key ?? {}) as Record<string, unknown>;
    if (q.question_type === "multiple_choice") {
      const perRaw = key.score;
      const per = typeof perRaw === "number" ? perRaw : parseInt(String(perRaw ?? "1"), 10) || 1;
      maxScore += per;
      const correct = String(key.correct ?? "").toUpperCase();
      if (chosen) {
        if (chosen === correct) mcCorrect += 1;
        else mcWrong += 1;
      }
      return;
    }

    const numericEntries = Object.entries(key)
      .filter(([, v]) => typeof v === "number")
      .map(([, v]) => v as number);
    maxScore += numericEntries.length ? Math.max(...numericEntries) : 0;
  });

  const totalQuestions = ordered.length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);

  // Attempt number for this package (ordered by started_at)
  const { count: attemptNoRaw } = await supabase
    .from("user_exam_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user?.id ?? "")
    .eq("package_id", session.package_id)
    .lte("started_at", session.started_at);

  const attemptNo = attemptNoRaw ?? null;
  const scoreTotal = typeof session.score_total === "number" ? session.score_total : null;

  return (
    <SidebarShell
      title="Review Tryout"
      roleLabel={admin ? "Role: admin" : "Role: user"}
      userEmail={user?.email}
      nav={[
        { href: "/", label: "Dashboard", description: "Kembali" },
        { href: "/account", label: "Akun", description: "Profil" },
        { href: "/leaderboard", label: "Leaderboard", description: "Umum" },
        { href: "/tryout/history", label: "Riwayat Tryout", description: "Semua" },
        ...(pkgSlug
          ? [
              {
                href: `/leaderboard/tryout/${encodeURIComponent(pkgSlug)}`,
                label: "Leaderboard Paket",
                description: pkgSlug,
              },
            ]
          : []),
        ...(pkgSlug ? [{ href: `/tryout/real/${encodeURIComponent(pkgSlug)}`, label: "Mulai Lagi", description: pkgSlug }] : []),
        { href: "/logout", label: "Sign out", description: "Keluar", variant: "danger" },
      ]}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Link href="/tryout/history" className="inline-flex text-sm text-slate-600 hover:text-slate-900">
            ← Kembali ke Riwayat
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Review: {pkgTitle}</h1>
          <p className="text-sm text-slate-600">
            {attemptNo ? (
              <>
                Percobaan ke-<span className="font-semibold text-slate-900">{attemptNo}</span> ·{" "}
              </>
            ) : null}
            Mulai: <span className="font-semibold text-slate-900">{startedLabel}</span> · Selesai:{" "}
            <span className="font-semibold text-slate-900">{finishedLabel}</span> · Status:{" "}
            <span className="font-semibold text-slate-900">{session.status}</span>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="text-xs text-slate-600">Skor</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {scoreTotal ?? "-"}/{maxScore}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
            <div className="text-xs text-emerald-700">Benar (MC)</div>
            <div className="mt-1 text-2xl font-bold text-emerald-900">{mcCorrect}</div>
            <div className="text-xs font-semibold text-emerald-800">Salah (MC): {mcWrong}</div>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-5">
            <div className="text-xs text-sky-700">Dijawab</div>
            <div className="mt-1 text-2xl font-bold text-sky-900">{answeredCount}</div>
            <div className="text-xs text-sky-700">dari {totalQuestions}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <div className="text-xs text-amber-800">Belum dijawab</div>
            <div className="mt-1 text-2xl font-bold text-amber-900">{unansweredCount}</div>
          </div>
        </div>

        {ordered.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            Tidak ada data jawaban untuk sesi ini.
          </div>
        ) : (
          <div className="space-y-4">
            {ordered.map(({ a, q }, idx) => {
              const chosen = String(a.answer_chosen ?? "").trim().toUpperCase();
              const key = (q.answer_key ?? {}) as Record<string, unknown>;

              let isCorrect = false;
              let correctAnswer = "";
              let maxPossible = 0;
              let scoreObtained = typeof a.score_obtained === "number" ? a.score_obtained : 0;

              if (q.question_type === "multiple_choice") {
                correctAnswer = String(key.correct ?? "").toUpperCase();
                const perRaw = key.score;
                maxPossible = typeof perRaw === "number" ? perRaw : parseInt(String(perRaw ?? "1"), 10) || 1;
                isCorrect = Boolean(chosen) && chosen === correctAnswer;
                if (typeof a.score_obtained !== "number") {
                  scoreObtained = isCorrect ? maxPossible : 0;
                }
              } else {
                const numericEntries = Object.entries(key)
                  .filter(([, v]) => typeof v === "number")
                  .map(([, v]) => v as number);
                maxPossible = numericEntries.length ? Math.max(...numericEntries) : 0;
              }

              const cardClass = isCorrect
                ? "border-emerald-200 bg-emerald-50"
                : chosen
                  ? "border-rose-200 bg-rose-50"
                  : "border-slate-200 bg-white";

              const options = normalizeOptions(q.options);

              return (
                <div key={q.id} className={`rounded-lg border p-6 ${cardClass}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">Soal #{idx + 1}</span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        q.question_type === "scale_tkp"
                          ? "bg-sky-100 text-sky-700"
                          : isCorrect
                            ? "bg-emerald-100 text-emerald-700"
                            : chosen
                              ? "bg-rose-100 text-rose-700"
                              : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {q.question_type === "scale_tkp"
                        ? chosen
                          ? "TKP (dipilih)"
                          : "TKP (kosong)"
                        : isCorrect
                          ? "✓ Benar"
                          : chosen
                            ? "✗ Salah"
                            : "Tidak dijawab"}
                    </span>
                  </div>

                  <MathText text={q.question_text} className="mt-3 text-base font-semibold text-slate-900" />

                  {options.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {options.map((opt) => {
                        const k = opt.key.toUpperCase();
                        const isChosen = chosen === k;
                        const isCorrectOpt = q.question_type === "multiple_choice" && correctAnswer === k;

                        const tkpScore =
                          q.question_type === "scale_tkp" ? (key[k] as unknown) : null;

                        return (
                          <div
                            key={k}
                            className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${
                              isCorrectOpt
                                ? "border-emerald-300 bg-emerald-100"
                                : isChosen
                                  ? "border-sky-300 bg-sky-100"
                                  : "border-slate-200 bg-white"
                            }`}
                          >
                            <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-semibold">
                              {k}
                            </span>
                            <div className="flex-1">
                              <MathText text={opt.text} className="text-slate-900" />
                              {q.question_type === "multiple_choice" && isCorrectOpt ? (
                                <span className="ml-2 text-xs font-semibold text-emerald-700">✓ Jawaban Benar</span>
                              ) : null}
                              {q.question_type === "multiple_choice" && isChosen && !isCorrectOpt ? (
                                <span className="ml-2 text-xs font-semibold text-rose-700">Jawaban Anda</span>
                              ) : null}
                              {q.question_type === "scale_tkp" ? (
                                <span className="ml-2 text-xs font-semibold text-sky-800">
                                  Skor: {typeof tkpScore === "number" ? tkpScore : "-"}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {q.discussion ? (
                    <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Pembahasan</p>
                      <MathText text={q.discussion} className="mt-2 text-sm text-sky-900" />
                    </div>
                  ) : null}

                  <div className="mt-3 text-sm text-slate-600">
                    Skor: {scoreObtained}/{maxPossible}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SidebarShell>
  );
}
