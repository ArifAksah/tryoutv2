import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type SubscriptionPlan = {
    id: string;
    title: string;
    description: string | null;
    price: number;
    features: string[] | null;
    is_active: boolean;
};

export async function LandingView() {
    const supabase = await getSupabaseServerClient("read");

    // Fetch active plans
    const { data: plansData } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

    const plans = (plansData ?? []) as SubscriptionPlan[];

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-slate-900/80 backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
                    <div className="text-xl font-bold text-white">
                        <span className="text-indigo-400">Tryout</span>App
                    </div>
                    <nav className="flex items-center gap-4">
                        <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition">
                            Masuk
                        </Link>
                        <Link
                            href="/login"
                            className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                        >
                            Daftar Sekarang
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative overflow-hidden bg-slate-900 pt-32 pb-20 text-center lg:pt-48 lg:pb-32">
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 right-0 h-[500px] w-[500px] -translate-y-1/2 translate-x-1/2 rounded-full bg-indigo-500/20 blur-[120px]" />
                    <div className="absolute bottom-0 left-0 h-[500px] w-[500px] translate-y-1/2 -translate-x-1/2 rounded-full bg-violet-500/20 blur-[120px]" />
                </div>

                <div className="relative z-10 mx-auto max-w-4xl px-6">
                    <h1 className="bg-gradient-to-r from-indigo-200 via-white to-indigo-200 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl lg:text-7xl">
                        Lulus Ujian Impian<br />Jadi Lebih Mudah.
                    </h1>
                    <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
                        Platform latihan soal paling lengkap untuk persiapan CPNS, BUMN, dan Sekolah Kedinasan.
                        Ribuan soal terupdate dengan pembahasan mendalam.
                    </p>
                    <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                        <a
                            href="#pricing"
                            className="w-full rounded-full bg-indigo-600 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500 hover:shadow-indigo-500/40 sm:w-auto"
                        >
                            Lihat Paket Belajar
                        </a>
                        <Link
                            href="/login"
                            className="w-full rounded-full border border-slate-700 bg-slate-800/50 px-8 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-slate-800 sm:w-auto"
                        >
                            Masuk Member
                        </Link>
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-20 lg:py-32">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="text-center">
                        <h2 className="text-base font-semibold uppercase tracking-wide text-indigo-600">Pricing</h2>
                        <p className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
                            Investasi Terbaik untuk Masa Depanmu
                        </p>
                        <p className="mt-4 text-lg text-slate-600">
                            Pilih paket yang sesuai dengan kebutuhan belajarmu.
                        </p>
                    </div>

                    <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {plans.map((plan) => (
                            <div
                                key={plan.id}
                                className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10"
                            >
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-slate-900">{plan.title}</h3>
                                    <div className="mt-4 flex items-baseline gap-1">
                                        <span className="text-4xl font-extrabold text-indigo-600">
                                            Rp {(plan.price / 1000).toLocaleString("id-ID")}k
                                        </span>
                                        <span className="text-base font-medium text-slate-500">/ paket</span>
                                    </div>
                                    <p className="mt-4 text-sm leading-relaxed text-slate-500">{plan.description}</p>
                                </div>

                                <ul className="flex-1 space-y-4 mb-8">
                                    {Array.isArray(plan.features) && plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                                            <svg className="h-5 w-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    href="/login?next=/pricing"
                                    className="block w-full rounded-xl bg-slate-900 py-3.5 text-center text-sm font-bold text-white transition hover:bg-slate-800 hover:shadow-lg focus:ring-4 focus:ring-slate-200"
                                >
                                    Pilih Paket Ini
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <footer className="border-t border-slate-200 bg-white py-12">
                <div className="mx-auto max-w-7xl px-6 text-center text-slate-500">
                    <p className="text-sm">
                        &copy; {new Date().getFullYear()} TryoutApp. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
