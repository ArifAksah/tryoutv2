import Link from "next/link";
import { SidebarShell } from "@/components/sidebar-shell";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { subscribeToPlan } from "./actions";

export const dynamic = "force-dynamic";

type SubscriptionPlan = {
    id: string;
    title: string;
    description: string | null;
    price: number;
    features: string[] | null;
    is_active: boolean;
};

type UserSubscription = {
    id: string;
    plan_id: string;
    status: string;
};

export default async function PricingPage() {
    const user = await getCurrentUser();
    const admin = await isAdminUser();

    const supabase = await getSupabaseServerClient("read");

    // Fetch active plans
    const { data: plansData } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

    const plans = (plansData ?? []) as SubscriptionPlan[];

    // Fetch user subscriptions if logged in
    let userSubs: UserSubscription[] = [];
    if (user) {
        const { data: subsData } = await supabase
            .from("user_subscriptions")
            .select("id, plan_id, status")
            .eq("user_id", user.id);
        userSubs = (subsData ?? []) as UserSubscription[];
    }

    const getSubStatus = (planId: string) => {
        const sub = userSubs.find((s) => s.plan_id === planId);
        return sub?.status ?? null; // null, 'waiting', 'approved', 'rejected'
    };

    const navLinks = [
        { href: "/", label: "Dashboard", description: "Beranda", group: "Menu Utama" },
        { href: "/pricing", label: "Langganan", description: "Paket & Harga", group: "Menu Utama", variant: "primary" as const },
        { href: "/leaderboard", label: "Leaderboard", description: "Ranking", group: "Menu Utama" },
        { href: "/tryout/history", label: "Riwayat Tryout", description: "Review", group: "Latihan" },
        { href: "/practice/history", label: "Riwayat Latihan", description: "Review", group: "Latihan" },
        { href: "/account", label: "Akun", description: "Profil", group: "Akun" },
        ...(admin ? [{ href: "/admin", label: "Admin", description: "Kelola data", variant: "primary" as const, group: "Admin" }] : []),
        { href: "/logout", label: "Keluar", description: "Sign out", variant: "danger" as const, group: "Akun" },
    ];

    return (
        <SidebarShell
            title="Langganan"
            roleLabel={admin ? "Admin" : "User"}
            userEmail={user?.email}
            nav={navLinks}
        >
            <div className="flex flex-col gap-6 pb-24 md:gap-8 md:pb-10">
                <section className="text-center space-y-4 max-w-2xl mx-auto pt-8">
                    <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">Pilih Paket Belajarmu</h1>
                    <p className="text-lg text-slate-600">
                        Dapatkan akses ke ribuan soal dan materi eksklusif untuk persiapan ujianmu.
                    </p>
                </section>

                <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto px-4">
                    {plans.map((plan) => {
                        const status = getSubStatus(plan.id);
                        return (
                            <div key={plan.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-indigo-200">
                                <div className="mb-4">
                                    <h3 className="text-xl font-bold text-slate-900">{plan.title}</h3>
                                    <div className="mt-2 flex items-baseline gap-1">
                                        <span className="text-3xl font-bold text-indigo-600">
                                            Rp {(plan.price / 1000).toLocaleString("id-ID")}k
                                        </span>
                                        <span className="text-sm font-semibold text-slate-500">/ paket</span>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-2">{plan.description}</p>
                                </div>

                                <div className="flex-1 space-y-3 border-t border-slate-100 pt-6">
                                    {Array.isArray(plan.features) && plan.features.map((feature, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <span className="text-sm text-slate-700">{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-8">
                                    {!user ? (
                                        <Link
                                            href={`/login?next=/pricing`}
                                            className="block w-full rounded-xl bg-slate-900 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-800"
                                        >
                                            Masuk untuk Daftar
                                        </Link>
                                    ) : status === 'approved' ? (
                                        <button disabled className="block w-full rounded-xl bg-emerald-100 py-3 text-center text-sm font-bold text-emerald-700 cursor-default">
                                            Sudah Aktif ✓
                                        </button>
                                    ) : status === 'waiting' ? (
                                        <button disabled className="block w-full rounded-xl bg-amber-100 py-3 text-center text-sm font-bold text-amber-700 cursor-default">
                                            Menunggu Verifikasi ⏳
                                        </button>
                                    ) : (
                                        <form action={subscribeToPlan}>
                                            <input type="hidden" name="plan_id" value={plan.id} />
                                            <button
                                                type="submit"
                                                className="block w-full rounded-xl bg-indigo-600 py-3 text-center text-sm font-bold text-white transition hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-200"
                                            >
                                                Daftar Sekarang
                                            </button>
                                        </form>
                                    )}
                                    {status === 'rejected' && (
                                        <p className="mt-2 text-center text-xs text-rose-600">
                                            Permintaan sebelumnya ditolak. Silahkan daftar lagi.
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </section>
            </div>
        </SidebarShell>
    );
}
