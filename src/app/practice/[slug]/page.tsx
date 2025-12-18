import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PracticePage({ params }: Props) {
  const { slug } = await params;
  const user = await requireUser(`/practice/${slug}`);

  const supabase = await getSupabaseServerClient("read");

  // Get category info
  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug, type")
    .eq("slug", slug)
    .single();

  if (!category) {
    redirect("/");
  }

  // Count questions in this category and descendants
  const { count: totalQuestions } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("category_id", category.id);

  const questionOptions = [10, 20, 30, 50, totalQuestions || 10].filter(
    (n, i, arr) => n <= (totalQuestions || 0) && arr.indexOf(n) === i
  );

  const { count: attemptCount } = await supabase
    .from("user_practice_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("category_id", category.id);

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-6 p-6">
      <div className="space-y-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          ← Kembali ke Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Latihan: {category.name}</h1>
        <p className="text-slate-600">
          Mode latihan bebas tanpa timer. Pilih jumlah soal yang ingin kamu kerjakan.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Total soal tersedia:</span>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-bold text-sky-700">
              {totalQuestions} soal
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-900">Pilih jumlah soal:</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {questionOptions.map((count) => (
                <Link
                  key={count}
                  href={`/practice/${slug}/start?take=${count}`}
                  className="rounded-lg border-2 border-sky-200 bg-sky-50 px-6 py-4 text-center font-bold text-sky-900 transition hover:border-sky-300 hover:bg-sky-100"
                >
                  {count} soal
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">💡 Tips Latihan</p>
            <ul className="mt-2 space-y-1 text-amber-800">
              <li>• Tidak ada timer, kerjakan dengan santai</li>
              <li>• Setelah submit, kamu bisa review jawaban dan pembahasan</li>
              <li>• Gunakan latihan untuk memahami tipe soal</li>
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Riwayat Latihan</p>
                <p className="text-xs text-slate-600">Total percobaan tersimpan: {attemptCount ?? 0}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/leaderboard/practice/${encodeURIComponent(slug)}`}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  Leaderboard Topik
                </Link>
                <Link
                  href={`/practice/${slug}/history`}
                  className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Lihat Riwayat
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
