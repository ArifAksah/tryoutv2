import Link from "next/link";
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
        { href: "/", label: "Dashboard", description: "Beranda", group: "Menu Utama" },
        { href: "/leaderboard", label: "Leaderboard", description: "Ranking", group: "Menu Utama" },
        { href: "/tryout/history", label: "Riwayat Tryout", description: "Review", group: "Latihan" },
        { href: "/practice/history", label: "Riwayat Latihan", description: "Review", group: "Latihan" },
        { href: "/account", label: "Akun", description: "Profil", group: "Akun" },
        ...(admin ? [{ href: "/admin", label: "Admin", description: "Kelola data", variant: "primary" as const, group: "Admin" }] : []),
        { href: "/logout", label: "Keluar", description: "Sign out", variant: "danger" as const, group: "Akun" },
      ]}
    >
      <div className="flex flex-col gap-6 pb-24 md:gap-8 md:pb-10">
        {/* Welcome Section */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-lg md:p-8">
          <div className="relative z-10 space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold md:text-3xl">Hai, {user?.email?.split('@')[0] || 'Pejuang'}! 👋</h1>
              <p className="text-indigo-100 opacity-90">Siap untuk latihan hari ini?</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <ConfirmStartTryoutButton
                href="/tryout/real/skd"
                durationMinutes={100}
                title="Mulai Tryout SKD?"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50 active:scale-95 sm:w-auto"
              >
                🚀 Mulai Tryout SKD
              </ConfirmStartTryoutButton>
              <a
                href="#skb-section"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-5 py-3 font-semibold text-white backdrop-blur-sm transition hover:bg-indigo-500/30 active:scale-95 sm:w-auto"
              >
                📚 Latihan SKB
              </a>
            </div>
          </div>

          {/* Decorative shapes */}
          <div className="absolute -right-4 -top-4 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 right-10 h-24 w-24 rounded-full bg-purple-500/20 blur-xl" />
        </section>

        {/* Stats & Quick Info - Horizontal Scroll on Mobile */}
        <section className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:p-0">
          <div className="min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Modul SKD</p>
                <p className="text-xl font-bold text-slate-900">{skdSections.length}</p>
              </div>
            </div>
          </div>
          <div className="min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Sekolah SKB</p>
                <p className="text-xl font-bold text-slate-900">{skbSections.length}</p>
              </div>
            </div>
          </div>
          <div className="min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total Sub-topik</p>
                <p className="text-xl font-bold text-slate-900">{totalTopics}</p>
              </div>
            </div>
          </div>
        </section>

        {/* SKD Section */}
        <section id="skd" className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-slate-900">Materi SKD</h2>
            <Link href="/leaderboard" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              Lihat Ranking →
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skdSections.map((section) => (
              <ExamSectionCard key={section.id} section={section} />
            ))}
          </div>

          {skdPackages.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="px-1 text-sm font-semibold text-slate-500 uppercase tracking-wider">Tryout Paket</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {skdPackages.map((pkg) => (
                  <div key={pkg.slug} className="group relative overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 transition hover:border-emerald-200 hover:bg-emerald-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">{pkg.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">{pkg.totalQuestions} Soal · {pkg.durationMinutes} Menit</p>
                      </div>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                        ⏱️
                      </span>
                    </div>
                    <div className="mt-4">
                      <ConfirmStartTryoutButton
                        href={`/tryout/real/${encodeURIComponent(pkg.slug)}`}
                        durationMinutes={pkg.durationMinutes}
                        title={`Mulai ${pkg.title}?`}
                        className="block w-full rounded-lg bg-emerald-600 py-2 text-center text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
                      >
                        Mulai
                      </ConfirmStartTryoutButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* SKB Section */}
        <section id="skb-section" className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-slate-900">Materi SKB</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {skbSections.length} Sekolah
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

          {skbPackages.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="px-1 text-sm font-semibold text-slate-500 uppercase tracking-wider">Tryout SKB Paket</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {skbPackages.map((pkg) => (
                  <div key={pkg.slug} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300">
                    <h3 className="font-bold text-slate-900">{pkg.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{pkg.totalQuestions} Soal</p>
                    <div className="mt-3">
                      <ConfirmStartTryoutButton
                        href={`/tryout/real/${encodeURIComponent(pkg.slug)}`}
                        durationMinutes={pkg.durationMinutes}
                        title={`Mulai ${pkg.title}?`}
                        className="block w-full rounded-lg bg-indigo-600 py-2 text-center text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-95"
                      >
                        Mulai
                      </ConfirmStartTryoutButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </SidebarShell>
  );
}
