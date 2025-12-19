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

  // Fetch completed packages
  const { data: completedPackages } = await supabase
    .from("user_practice_sessions")
    .select("package_number")
    .eq("user_id", user.id)
    .eq("category_id", category.id)
    .not("package_number", "is", null);

  const completedSet = new Set(completedPackages?.map((p) => p.package_number) ?? []);
  const totalPackages = totalQuestions ? Math.ceil(totalQuestions / 10) : 0;
  const packages = Array.from({ length: totalPackages }, (_, i) => i + 1);

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
          Pilih paket latihan terstruktur atau mode custom sesuai kebutuhanmu.
        </p>
      </div>

      <div className="space-y-6">
        {/* Practice Packages Section */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">📦 Paket Latihan</h2>
              <p className="text-sm text-slate-600">
                Latihan terstruktur per 10 soal dengan timer 10 menit.
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              {completedSet.size}/{packages.length} Selesai
            </span>
          </div>

          {packages.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {packages.map((pkgNum) => {
                const isCompleted = completedSet.has(pkgNum);
                return (
                  <Link
                    key={pkgNum}
                    href={`/practice/${slug}/start?package=${pkgNum}`}
                    className={`group relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 px-4 py-4 text-center transition ${isCompleted
                      ? "border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100"
                      : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50"
                      }`}
                  >
                    <span
                      className={`font-bold ${isCompleted ? "text-emerald-900" : "text-slate-900 group-hover:text-sky-900"
                        }`}
                    >
                      Paket {pkgNum}
                    </span>
                    {isCompleted ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        ✅ Selesai
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 group-hover:text-sky-700">
                        10 Soal · 10 Menit
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
              Belum ada paket soal yang tersedia untuk kategori ini.
            </div>
          )}
        </div>

        {/* Custom Mode Section */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">⚡ Mode Custom</h2>
            <p className="text-sm text-slate-600">
              Latihan bebas tanpa timer, pilih jumlah soal sesukamu.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Total soal tersedia:</span>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-bold text-sky-700">
                {totalQuestions} soal
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Pilih jumlah soal:</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {questionOptions.map((count) => (
                  <Link
                    key={count}
                    href={`/practice/${slug}/start?take=${count}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center font-bold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900"
                  >
                    {count} soal
                  </Link>
                ))}
              </div>
            </div>
          </div>
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
  );
}
