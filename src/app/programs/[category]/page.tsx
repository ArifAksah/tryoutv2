import Link from "next/link";
import { SidebarShell } from "@/components/sidebar-shell";
import { ExamSectionCard } from "@/components/exam-section-card";
import { SkbSectionCard } from "@/components/skb-section-card";
import { ConfirmStartTryoutButton } from "@/components/confirm-start-tryout-button";
import { fetchExamStructure } from "@/lib/exam-structure";
import { fetchQuestionsForSection, Question } from "@/lib/questions";
import { getCurrentUser, isAdminUser, requireUser } from "@/lib/auth";
import { getSupabaseServerClient, hasSupabasePublicEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
    params: Promise<{ category: string }>;
};

export default async function ProgramPage({ params }: Props) {
    const { category } = await params;
    const decodedCategory = decodeURIComponent(category).toLowerCase();

    await requireUser(`/programs/${decodedCategory}`);
    const user = await getCurrentUser();
    const admin = await isAdminUser();

    const { sections } = await fetchExamStructure();

    // Helper types
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

    type TryoutPackageInfo = {
        slug: string;
        title: string;
        description: string | null;
        durationMinutes: number | null;
        totalQuestions: number;
        group: string;
    };

    // 1. Fetch Packages & classify them
    let categoryPackages: TryoutPackageInfo[] = [];

    if (hasSupabasePublicEnv()) {
        const supabase = await getSupabaseServerClient("read");

        // Fetch categories to build lookup
        const { data: categoriesData } = await supabase.from("categories").select("id, slug, parent_id");
        const categoryById = new Map((categoriesData ?? []).map((c) => [c.id, c] as const));
        const getRootSlug = (categoryId: string): string => {
            const visited = new Set<string>();
            let cur = categoryById.get(categoryId);
            while (cur?.parent_id) {
                if (visited.has(cur.id)) break;
                visited.add(cur.id);
                cur = categoryById.get(cur.parent_id);
            }
            return cur?.slug?.toLowerCase() ?? "unknown";
        };

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

        const aggByPackage = new Map<string, { total: number; rootSlugs: Set<string> }>();
        blueprints.forEach((b) => {
            const acc = aggByPackage.get(b.package_id) ?? { total: 0, rootSlugs: new Set<string>() };
            acc.total += b.question_count ?? 0;
            acc.rootSlugs.add(getRootSlug(b.category_id));
            aggByPackage.set(b.package_id, acc);
        });

        categoryPackages = packages
            .map((p) => {
                const agg = aggByPackage.get(p.id) ?? { total: 0, rootSlugs: new Set<string>() };
                const roots = Array.from(agg.rootSlugs);
                let type = "unknown";
                if (roots.includes("skd")) type = "skd";
                else if (roots.includes("skb")) type = "skb";
                else if (roots.length > 0) type = roots[0].toLowerCase();

                return {
                    slug: p.slug,
                    title: p.title,
                    description: p.description,
                    durationMinutes: p.duration_minutes,
                    totalQuestions: agg.total,
                    group: type,
                };
            })
            .filter(p => p.group === decodedCategory);
    }

    // 2. Filter Sections
    // Note: sections.type is usually uppercase (SKD, SKB, UTBK)
    const targetTypeUpper = decodedCategory.toUpperCase();
    const categorySections = sections.filter(s => s.type === targetTypeUpper);

    // 3. Fetch Questions for "School" type sections (non-SKD generally need questions fetched to show counts properly in SKB cards)
    // SKD sections use ExamSectionCard which doesn't need external question prop?
    // Let's check logic. SKBSectionCard takes `questions`. ExamSectionCard takes `section`.
    // For consistence, we fetch questions for all displayed sections to pass if needed.
    const questionsMap = new Map<string, Question[]>();
    if (categorySections.length > 0) {
        await Promise.all(categorySections.map(async (s) => {
            const res = await fetchQuestionsForSection(s.id);
            if (res.questions.length > 0) questionsMap.set(s.id, res.questions);
        }));
    }

    const titleMap: Record<string, string> = {
        "skd": "Seleksi Kompetensi Dasar",
        "skb": "Seleksi Kompetensi Bidang",
        "utbk": "UTBK SNBT"
    };
    const pageTitle = titleMap[decodedCategory] ?? targetTypeUpper;

    return (
        <SidebarShell
            title={`Program ${targetTypeUpper}`}
            roleLabel={admin ? "Admin" : "User"}
            userEmail={user?.email}
            nav={[
                { href: "/", label: "Dashboard", description: "Kembali ke Menu Utama" },
                { href: "/account", label: "Akun", description: "Profil" },
                { href: "/leaderboard", label: "Leaderboard", description: "Ranking" },
            ]}
        >
            <div className="flex flex-col gap-6 pb-24 md:pb-10">
                <div className="space-y-1">
                    <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800">← Kembali ke Dashboard</Link>
                    <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
                    <p className="text-sm text-slate-600">Pilih modul materi atau kerjakan tryout simulasi.</p>
                </div>

                {/* Tryout Packages */}
                {categoryPackages.length > 0 && (
                    <section className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-100 text-xs">⏱️</span>
                            <h2 className="font-bold text-slate-900">Tryout Simulasi</h2>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {categoryPackages.map(pkg => (
                                <div key={pkg.slug} className="group relative overflow-hidden rounded-xl border border-indigo-100 bg-white p-4 shadow-sm transition hover:border-indigo-300">
                                    <h3 className="font-bold text-slate-900">{pkg.title}</h3>
                                    <p className="text-xs text-slate-500 mt-1">{pkg.totalQuestions} Soal · {pkg.durationMinutes} Menit</p>
                                    <div className="mt-4">
                                        <ConfirmStartTryoutButton
                                            href={`/tryout/real/${encodeURIComponent(pkg.slug)}`}
                                            durationMinutes={pkg.durationMinutes}
                                            title={`Mulai ${pkg.title}?`}
                                            className="block w-full rounded-lg bg-indigo-600 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-700"
                                        >
                                            Mulai Tryout
                                        </ConfirmStartTryoutButton>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Sections / Modules */}
                {categorySections.length > 0 ? (
                    <section className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-100 text-xs">📚</span>
                            <h2 className="font-bold text-slate-900">Modul & Materi</h2>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {categorySections.map(section => {
                                // Use SkbSectionCard for non-SKD or generically?
                                // ExamSectionCard is specialized for SKD structure (TWK/TIU/TKP).
                                // SkbSectionCard is generic for list of questions.
                                // UTBK is composite.
                                // Let's stick to SkbSectionCard for everything except classic SKD?
                                // Or just check if type is SKD.
                                if (decodedCategory === "skd") {
                                    return <ExamSectionCard key={section.id} section={section} />;
                                }
                                return (
                                    <SkbSectionCard
                                        key={section.id}
                                        section={section}
                                        questions={questionsMap.get(section.id) ?? []}
                                    />
                                );
                            })}
                        </div>
                    </section>
                ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                        Belum ada materi untuk program ini.
                    </div>
                )}
            </div>
        </SidebarShell>
    );
}
