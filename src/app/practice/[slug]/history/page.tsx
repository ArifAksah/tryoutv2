import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PracticeHistoryPage({ params }: Props) {
  const { slug } = await params;
  const user = await requireUser(`/practice/${slug}/history`);

  const supabase = await getSupabaseServerClient("read");

  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!category) redirect("/");

  const { count: totalAttempts } = await supabase
    .from("user_practice_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("category_id", category.id);

  const { data: sessions } = await supabase
    .from("user_practice_sessions")
    .select(
      "id, started_at, finished_at, score_total, max_score, correct_count, total_questions, take_count, answers, doubts"
    )
    .eq("user_id", user.id)
    .eq("category_id", category.id)
    .order("started_at", { ascending: false })
    .limit(50);

  const rows = (sessions ?? []) as Array<{
    id: string;
    started_at: string;
    finished_at: string | null;
    score_total: number;
    max_score: number;
    correct_count: number;
    total_questions: number;
    take_count: number;
    answers: Record<string, unknown>;
    doubts: Record<string, unknown>;
  }>;

  return (
    <div className="mx-auto min-h-screen max-w-4xl space-y-6 p-6">
      <div className="space-y-2">
        <Link
          href={`/practice/${slug}`}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          ← Kembali
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Riwayat Latihan: {category.name}</h1>
        <p className="text-slate-600">
          Total percobaan: <span className="font-semibold text-slate-900">{totalAttempts ?? 0}</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="font-semibold text-slate-900">Belum ada riwayat latihan.</p>
          <p className="mt-1 text-sm text-slate-600">Mulai latihan dulu, lalu submit untuk tersimpan di history.</p>
          <Link
            href={`/practice/${slug}`}
            className="mt-4 inline-flex rounded-lg bg-sky-600 px-5 py-2.5 font-semibold text-white hover:bg-sky-700"
          >
            Mulai Latihan
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="grid grid-cols-[120px_1fr_120px_120px_140px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
            <div>Percobaan</div>
            <div>Waktu</div>
            <div className="text-right">Status</div>
            <div className="text-right">Skor</div>
            <div className="text-right">Aksi</div>
          </div>
          <div className="divide-y divide-slate-200">
            {rows.map((s, idx) => {
              const n = (totalAttempts ?? rows.length) - idx;
              const startLabel = s.started_at ? new Date(s.started_at).toLocaleString("id-ID") : "-";
              const finishLabel = s.finished_at ? new Date(s.finished_at).toLocaleString("id-ID") : "-";

              const answersObj = (s.answers ?? {}) as Record<string, unknown>;
              const doubtsObj = (s.doubts ?? {}) as Record<string, unknown>;
              const answered = Object.values(answersObj).filter((v) => String(v ?? "").trim()).length;
              const unanswered = Math.max(0, s.total_questions - answered);
              const doubtful = Object.entries(doubtsObj).filter(
                ([qid, v]) => Boolean(v) && Boolean(String(answersObj[qid] ?? "").trim())
              ).length;

              return (
                <div
                  key={s.id}
                  className="grid grid-cols-[120px_1fr_120px_120px_140px] items-center gap-3 px-4 py-3"
                >
                  <div className="font-semibold text-slate-900">#{n}</div>
                  <div className="text-xs text-slate-600">
                    <div>Mulai: {startLabel}</div>
                    <div>Selesai: {finishLabel}</div>
                  </div>
                  <div className="text-right text-xs text-slate-700">
                    <div>
                      <span className="font-semibold text-slate-900">{answered}</span> dijawab
                    </div>
                    <div>
                      <span className="font-semibold text-rose-700">{unanswered}</span> kosong ·{" "}
                      <span className="font-semibold text-amber-700">{doubtful}</span> ragu
                    </div>
                  </div>
                  <div className="text-right text-sm font-semibold text-slate-900">
                    {s.score_total}/{s.max_score}
                  </div>
                  <div className="text-right">
                    <Link
                      href={`/practice/${slug}/history/${s.id}`}
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
    </div>
  );
}
