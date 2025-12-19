import { ExamSectionCard } from "@/components/exam-section-card";
import { SkbSectionCard } from "@/components/skb-section-card";
import { ConfirmStartTryoutButton } from "@/components/confirm-start-tryout-button";
import { SidebarShell } from "@/components/sidebar-shell";
import { fetchExamStructure } from "@/lib/exam-structure";
import { fetchQuestionsForSection, Question } from "@/lib/questions";
import { getCurrentUser, isAdminUser, requireUser } from "@/lib/auth";
import { getSupabaseServerClient, hasSupabasePublicEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    await requireUser("/");
  } catch (e) {
    console.error("Home page requireUser failed:", e);
    // Let the error propagate or handle redirection naturally
    throw e;
  }
  const user = await getCurrentUser();
  console.log("Home page user:", user?.id);
  const admin = await isAdminUser();
  const { sections, source } = await fetchExamStructure();

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

  type CategoryRow = { id: string; slug: string; parent_id: string | null };
  type TryoutPackageInfo = {
    slug: string;
    title: string;
    description: string | null;
    durationMinutes: number | null;
    totalQuestions: number;
    group: "SKD" | "SKB" | "OTHER";
  };

  let tryoutPackages: TryoutPackageInfo[] = [];

  if (hasSupabasePublicEnv()) {
    const supabase = await getSupabaseServerClient("read");
    const { data: packagesData } = await supabase
      .from("exam_packages")
      .select("id, slug, title, description, duration_minutes, is_active")
      .not("slug", "is", null)
      .eq("is_active", true)
      .order("inserted_at", { ascending: false });

    const packages = (packagesData ?? []) as PackageRow[];
    const packageIds = packages.map((p) => p.id);

    const { data: blueprintsData } = packageIds.length
      ? await supabase
        .from("exam_package_blueprints")
        .select("package_id, category_id, question_count")
        .in("package_id", packageIds)
      : { data: [] as unknown[] };

    const blueprints = (blueprintsData ?? []) as BlueprintRow[];

    const { data: categoriesData } = await supabase
      .from("categories")
      .select("id, slug, parent_id");

    const categories = (categoriesData ?? []) as CategoryRow[];
    const categoryById = new Map(categories.map((c) => [c.id, c] as const));

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

    const aggByPackage = new Map<
      string,
      { total: number; rootSlugs: Set<string> }
    >();

    blueprints.forEach((b) => {
      const acc = aggByPackage.get(b.package_id) ?? { total: 0, rootSlugs: new Set<string>() };
      acc.total += b.question_count ?? 0;
      acc.rootSlugs.add(getRootSlug(b.category_id));
      aggByPackage.set(b.package_id, acc);
    });

    tryoutPackages = packages.map((p) => {
      const agg = aggByPackage.get(p.id) ?? { total: 0, rootSlugs: new Set<string>() };
      const roots = agg.rootSlugs;
      const group: TryoutPackageInfo["group"] = roots.has("skd")
        ? "SKD"
        : roots.has("skb")
          ? "SKB"
          : "OTHER";

      return {
        slug: p.slug,
        title: p.title,
        description: p.description,
        durationMinutes: p.duration_minutes,
        totalQuestions: agg.total,
        group,
      };
    });
  }

  const skdSections = sections.filter((section) => section.type === "SKD");
  const skbSections = sections.filter((section) => section.type === "SKB");
  const skdPackages = tryoutPackages.filter((p) => p.group === "SKD");
  const skbPackages = tryoutPackages.filter((p) => p.group === "SKB");
  const otherPackages = tryoutPackages.filter((p) => p.group === "OTHER");
  const totalTopics = sections.reduce(
    (sum, section) => sum + section.topics.length,
    0
  );

  // Parallel fetch questions for ALL SKB sections to display them dynamically
  const skbQuestionsMap = new Map<string, Question[]>();
  if (skbSections.length > 0) {
    await Promise.all(
      skbSections.map(async (section) => {
        const result = await fetchQuestionsForSection(section.id);
        if (result.questions.length > 0) {
          skbQuestionsMap.set(section.id, result.questions);
        }
      })
    );
  }

  return (
    <SidebarShell
      title="Dashboard"
      roleLabel={admin ? "Admin" : "User"}
      userEmail={user?.email}
      nav={[
        { href: "/", label: "Dashboard", description: "Beranda" },
        { href: "/account", label: "Akun", description: "Profil" },
        { href: "/leaderboard", label: "Leaderboard", description: "Ranking" },
        { href: "/tryout/history", label: "Riwayat Tryout", description: "Review" },
        { href: "/practice/history", label: "Riwayat Latihan", description: "Review" },
        { href: "/#skd", label: "SKD", description: "TWK · TIU · TKP" },
        { href: "/#skb", label: "SKB", description: "Per sekolah" },
        ...(admin ? [{ href: "/admin", label: "Admin", description: "Kelola data", variant: "primary" as const }] : []),
        { href: "/logout", label: "Keluar", description: "Sign out", variant: "danger" as const },
      ]}
    >
      <div className="flex flex-col gap-6 pb-20 md:gap-8 md:pb-10">
        <section className="space-y-3 md:space-y-4">
          <div className="space-y-1 md:space-y-2">
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Selamat Datang, {user?.email?.split('@')[0] || 'User'}!</h1>
            <p className="text-sm text-slate-600 md:text-base">Pilih jenis tryout yang ingin kamu kerjakan</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 transition md:p-6">
              <div className="space-y-3 md:space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">SKD</span>
                  <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">{skdSections.length} Modul</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Seleksi Kompetensi Dasar</h3>
                <p className="text-sm text-slate-600">TWK, TIU, dan TKP dalam satu paket</p>
                <div className="mt-4 flex flex-col gap-2 md:flex-row">
                  <a href="#skd" className="flex-1 inline-block text-center rounded-lg border border-sky-600 px-4 py-2.5 text-sm font-semibold text-sky-700 hover:bg-sky-50 transition md:py-2">
                    Lihat Modul
                  </a>
                  <ConfirmStartTryoutButton
                    href="/tryout/real/skd"
                    durationMinutes={100}
                    title="Mulai Tryout Full SKD?"
                    className="flex-1 inline-block text-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition md:py-2"
                  >
                    Tryout Full ⏱️
                  </ConfirmStartTryoutButton>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 transition md:p-6">
              <div className="space-y-3 md:space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">SKB</span>
                  <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">{skbSections.length} Sekolah</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Seleksi Kompetensi Bidang</h3>
                <p className="text-sm text-slate-600">Materi per sekolah kedinasan</p>
                <a href="#skb" className="mt-4 inline-block w-full text-center rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition md:w-auto md:py-2">
                  Mulai SKB →
                </a>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-5 md:p-6">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Statistik</span>
                <div className="space-y-3 pt-2">
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{totalTopics}</div>
                    <div className="text-xs text-slate-600">Total Sub-Topik</div>
                  </div>
                  <div>
                    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${source === "supabase" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${source === "supabase" ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                      {source === "supabase" ? "Live Database" : "Sample Data"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="skd" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 md:text-2xl">SKD - Seleksi Kompetensi Dasar</h2>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">{skdSections.length} Modul</span>
          </div>

          {skdPackages.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Tryout Paket (Custom)</p>
                <p className="text-xs text-slate-500">{skdPackages.length} paket aktif</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {skdPackages.map((pkg) => (
                  <div key={pkg.slug} className="rounded-lg border border-slate-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tryout Paket</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">{pkg.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {pkg.totalQuestions} soal
                      {pkg.durationMinutes ? ` · ${pkg.durationMinutes} menit` : ""}
                      {pkg.slug ? ` · ${pkg.slug}` : ""}
                    </p>
                    {pkg.description ? <p className="mt-2 text-sm text-slate-600 line-clamp-2">{pkg.description}</p> : null}
                    <div className="mt-4">
                      <ConfirmStartTryoutButton
                        href={`/tryout/real/${encodeURIComponent(pkg.slug)}`}
                        durationMinutes={pkg.durationMinutes}
                        title={`Mulai Tryout: ${pkg.title}?`}
                        className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 md:py-2"
                      >
                        Mulai Tryout ⏱️
                      </ConfirmStartTryoutButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {skdSections.map((section) => (
              <ExamSectionCard key={section.id} section={section} />
            ))}
          </div>
        </section>

        <section id="skb" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 md:text-2xl">SKB - Seleksi Kompetensi Bidang</h2>
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">{skbSections.length} Sekolah</span>
          </div>

          {skbPackages.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Tryout Paket (Custom)</p>
                <p className="text-xs text-slate-500">{skbPackages.length} paket aktif</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {skbPackages.map((pkg) => (
                  <div key={pkg.slug} className="rounded-lg border border-slate-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tryout Paket</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">{pkg.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {pkg.totalQuestions} soal
                      {pkg.durationMinutes ? ` · ${pkg.durationMinutes} menit` : ""}
                      {pkg.slug ? ` · ${pkg.slug}` : ""}
                    </p>
                    {pkg.description ? <p className="mt-2 text-sm text-slate-600 line-clamp-2">{pkg.description}</p> : null}
                    <div className="mt-4">
                      <ConfirmStartTryoutButton
                        href={`/tryout/real/${encodeURIComponent(pkg.slug)}`}
                        durationMinutes={pkg.durationMinutes}
                        title={`Mulai Tryout: ${pkg.title}?`}
                        className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 md:py-2"
                      >
                        Mulai Tryout ⏱️
                      </ConfirmStartTryoutButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {skbSections.map((section) => {
              const questions = skbQuestionsMap.get(section.id) ?? [];
              return (
                <SkbSectionCard
                  key={section.id}
                  section={section}
                  questions={questions}
                />
              );
            })}
          </div>
        </section>

        {otherPackages.length > 0 ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 md:text-2xl">Tryout Paket Lainnya</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{otherPackages.length} Paket</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {otherPackages.map((pkg) => (
                <div key={pkg.slug} className="rounded-lg border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tryout Paket</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{pkg.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {pkg.totalQuestions} soal
                    {pkg.durationMinutes ? ` · ${pkg.durationMinutes} menit` : ""}
                    {pkg.slug ? ` · ${pkg.slug}` : ""}
                  </p>
                  <div className="mt-4">
                    <ConfirmStartTryoutButton
                      href={`/tryout/real/${encodeURIComponent(pkg.slug)}`}
                      durationMinutes={pkg.durationMinutes}
                      title={`Mulai Tryout: ${pkg.title}?`}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 md:py-2"
                    >
                      Mulai Tryout ⏱️
                    </ConfirmStartTryoutButton>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </SidebarShell>
  );
}
