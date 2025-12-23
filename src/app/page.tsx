import Link from "next/link";
import { ConfirmStartTryoutButton } from "@/components/confirm-start-tryout-button";
import { SidebarShell } from "@/components/sidebar-shell";
import { fetchExamStructure } from "@/lib/exam-structure";
import { getCurrentUser, isAdminUser, requireUser } from "@/lib/auth";
import { getSupabaseServerClient, hasSupabasePublicEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireUser("/");
  const user = await getCurrentUser();
  const admin = await isAdminUser();
  const { sections } = await fetchExamStructure();

  // --- 1. Fetch Packages for "Featured" section ---
  type PackageRow = {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    duration_minutes: number | null;
    is_active: boolean;
  };
  type BlueprintRow = {
    package_id: string;
    category_id: string;
    question_count: number;
  };

  let featuredPackages: Array<PackageRow & { totalQuestions: number; group: string }> = [];

  if (hasSupabasePublicEnv()) {
    const supabase = await getSupabaseServerClient("read");
    const { data: packagesData } = await supabase
      .from("exam_packages")
      .select("id, slug, title, description, duration_minutes, is_active")
      .not("slug", "is", null)
      .eq("is_active", true)
      .order("inserted_at", { ascending: false })
      .limit(5); // Only show top 5 featured

    const packages = (packagesData ?? []) as PackageRow[];
    const packageIds = packages.map((p) => p.id);

    const { data: blueprintsData } = packageIds.length
      ? await supabase
        .from("exam_package_blueprints")
        .select("package_id, category_id, question_count")
        .in("package_id", packageIds)
      : { data: [] as unknown[] };

    const blueprints = (blueprintsData ?? []) as BlueprintRow[];
    // Identify type (very basic)
    // We rely on assumption that we just want to show them. Group doesn't matter much for functionality, just label.

    const aggByPackage = new Map<string, number>();
    blueprints.forEach(b => {
      aggByPackage.set(b.package_id, (aggByPackage.get(b.package_id) ?? 0) + b.question_count);
    });

    featuredPackages = packages.map(p => ({
      ...p,
      totalQuestions: aggByPackage.get(p.id) ?? 0,
      group: "Tryout" // Generic label
    }));
  }

  // --- 2. Determine Available Programs ---
  // We scan sections to see what "types" exist (SKD, SKB, UTBK)
  const types = new Set<string>();
  sections.forEach(s => types.add(s.type));
  // Ensure default order
  const orderedTypes: string[] = [];
  if (types.has("SKD")) orderedTypes.push("SKD");
  if (types.has("UTBK")) orderedTypes.push("UTBK");
  if (types.has("SKB")) orderedTypes.push("SKB");
  // Add others
  types.forEach(t => {
    if (!orderedTypes.includes(t)) orderedTypes.push(t);
  });

  const programDescriptions: Record<string, string> = {
    "SKD": "Seleksi Kompetensi Dasar CPNS (TWK, TIU, TKP).",
    "SKB": "Seleksi Kompetensi Bidang (Berbagai Jabatan).",
    "UTBK": "Ujian Tulis Berbasis Komputer SNBT."
  };

  const programIcons: Record<string, string> = {
    "SKD": "🇮🇩",
    "SKB": "👨‍💼",
    "UTBK": "🎓"
  };

  return (
    <SidebarShell
      title="Dashboard"
      roleLabel={admin ? "Admin" : "User"}
      userEmail={user?.email}
      nav={[
        { href: "/", label: "Dashboard", description: "Menu Utama" },
        { href: "/leaderboard", label: "Leaderboard", description: "Ranking" },
        { href: "/account", label: "Akun", description: "Profil" },
        ...(admin ? [{ href: "/admin", label: "Admin", description: "Kelola", variant: "primary" as const }] : []),
        { href: "/logout", label: "Keluar", description: "Sign out", variant: "danger" as const },
      ]}
    >
      <div className="flex flex-col gap-6 pb-24 md:pb-10">

        {/* Welcome Hero */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-lg md:p-10">
          <div className="relative z-10">
            <h1 className="text-2xl font-bold md:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
              Halo, {user?.email?.split('@')[0]}! 🚀
            </h1>
            <p className="mt-2 text-slate-300 max-w-xl text-sm md:text-base leading-relaxed">
              Semakin sering latihan, semakin dekat dengan impianmu. Pilih program belajarmu hari ini.
            </p>
          </div>
          {/* Decorative */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
        </section>

        {/* PROGAM GRID */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4 px-1">Pilih Program</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {orderedTypes.map(type => {
              const count = sections.filter(s => s.type === type).length;
              return (
                <Link
                  key={type}
                  href={`/programs/${type.toLowerCase()}`}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md active:scale-95"
                >
                  <div className="flex items-start justify-between">
                    <div className="h-10 w-10 text-2xl flex items-center justify-center rounded-lg bg-slate-50 border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition">
                      {programIcons[type] ?? "📚"}
                    </div>
                    <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-full group-hover:bg-indigo-100 group-hover:text-indigo-700 transition">
                      {count} Modul
                    </span>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-700 transition">{type}</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {programDescriptions[type] ?? "Program pelatihan intensif."}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* FEATURED TRYOUTS */}
        {featuredPackages.length > 0 && (
          <section>
            <div className="flex items-center justify-between px-1 mb-4">
              <h2 className="text-lg font-bold text-slate-900">Tryout Terbaru</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
              {featuredPackages.map(pkg => (
                <div key={pkg.id} className="min-w-[280px] flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300 transition">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md">Featured</span>
                    <span className="text-xs text-slate-500">{pkg.duration_minutes} Menit</span>
                  </div>
                  <h3 className="font-bold text-slate-900 line-clamp-2">{pkg.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{pkg.totalQuestions} Soal</p>

                  <div className="mt-4">
                    <ConfirmStartTryoutButton
                      href={`/tryout/real/${encodeURIComponent(pkg.slug)}`}
                      durationMinutes={pkg.duration_minutes}
                      title={`Mulai ${pkg.title}?`}
                      className="w-full rounded-lg bg-emerald-600 py-2 text-center text-xs font-bold text-white uppercase tracking-wider hover:bg-emerald-700"
                    >
                      Mulai Sekarang
                    </ConfirmStartTryoutButton>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </SidebarShell>
  );
}
