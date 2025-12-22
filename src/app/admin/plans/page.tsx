import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { upsertPlan, deletePlan } from "./actions";

export const dynamic = "force-dynamic";

type Props = {
    searchParams: Promise<{ edit?: string }>;
};

type SubscriptionPlan = {
    id: string;
    title: string;
    description: string | null;
    price: number;
    features: string[] | null;
    is_active: boolean;
};

export default async function AdminPlansPage({ searchParams }: Props) {
    await requireAdminUser("/admin/plans");
    const { edit } = await searchParams;

    const supabase = await getSupabaseServerClient("read");
    const { data: plansData } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("created_at", { ascending: false });

    const plans = (plansData ?? []) as SubscriptionPlan[];

    const editingPlan = edit ? plans.find((p) => p.id === edit) : null;

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</p>
                <h1 className="text-2xl font-bold text-slate-900">Paket Berlangganan</h1>
                <p className="text-sm text-slate-700">
                    Kelola paket langganan (IELTS, LPDP, TOEFL, dll) yang akan tampil di halaman pricing.
                </p>
            </div>

            {/* Form Section */}
            <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-slate-900">
                        {editingPlan ? `Edit Paket: ${editingPlan.title}` : "Buat Paket Baru"}
                    </h2>
                    {editingPlan && (
                        <Link href="/admin/plans" className="text-xs text-rose-600 hover:underline">
                            Batal Edit
                        </Link>
                    )}
                </div>

                <form action={upsertPlan} className="grid gap-4 md:grid-cols-2">
                    {editingPlan && <input type="hidden" name="id" value={editingPlan.id} />}

                    <label className="block space-y-2 md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Judul Paket</span>
                        <input
                            name="title"
                            defaultValue={editingPlan?.title}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
                            placeholder="Contoh: Paket IELTS Premium"
                            required
                        />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Harga (Rp)</span>
                        <input
                            name="price"
                            type="number"
                            defaultValue={editingPlan?.price ?? 0}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
                            required
                        />
                    </label>

                    <label className="flex items-center gap-2 mt-auto pb-3">
                        <input
                            name="is_active"
                            type="checkbox"
                            defaultChecked={editingPlan?.is_active ?? true}
                            className="h-4 w-4 accent-indigo-600"
                        />
                        <span className="text-sm text-slate-700">Aktif (Tampil di Pricing)</span>
                    </label>

                    <label className="block space-y-2 md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Deskripsi Singkat</span>
                        <input
                            name="description"
                            defaultValue={editingPlan?.description ?? ""}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
                            placeholder="Deskripsi singkat untuk kartu paket..."
                        />
                    </label>

                    <label className="block space-y-2 md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fitur (Satu per baris)</span>
                        <textarea
                            name="features"
                            defaultValue={Array.isArray(editingPlan?.features) ? editingPlan!.features.join("\n") : ""}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 min-h-[100px]"
                            placeholder={"Akses Materi IELTS\nLive Class zoom\nBank Soal Update"}
                        />
                    </label>

                    <div className="md:col-span-2">
                        <button
                            type="submit"
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        >
                            {editingPlan ? "Simpan Perubahan" : "Buat Paket"}
                        </button>
                    </div>
                </form>
            </section>

            {/* List Section */}
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => (
                    <div key={plan.id} className={`flex flex-col rounded-xl border p-4 shadow-sm ${plan.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-75'}`}>
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-bold text-slate-900">{plan.title}</h3>
                                <p className="text-xs font-medium text-emerald-600 mt-0.5">
                                    Rp {plan.price.toLocaleString("id-ID")}
                                </p>
                            </div>
                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${plan.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                {plan.is_active ? 'Active' : 'Inactive'}
                            </div>
                        </div>

                        {plan.description && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{plan.description}</p>}

                        <div className="mt-3 space-y-1">
                            {Array.isArray(plan.features) && plan.features.slice(0, 3).map((f, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                                    <span className="text-emerald-500">✓</span>
                                    <span className="truncate">{f}</span>
                                </div>
                            ))}
                            {Array.isArray(plan.features) && plan.features.length > 3 && (
                                <p className="text-xs text-slate-400 pl-4">+ {plan.features.length - 3} fitur lainnya</p>
                            )}
                        </div>

                        <div className="mt-auto pt-4 flex items-center justify-between gap-2">
                            <Link
                                href={`/admin/plans?edit=${plan.id}`}
                                className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Edit
                            </Link>
                            <Link
                                href={`/admin/plans/${plan.id}/entitlements`}
                                className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Konten
                            </Link>
                            <form action={deletePlan} className="flex-1">
                                <input type="hidden" name="id" value={plan.id} />
                                <button
                                    type="submit"
                                    className="w-full rounded-lg border border-rose-200 bg-white py-1.5 text-center text-xs font-semibold text-rose-600 hover:bg-rose-50"
                                >
                                    Hapus
                                </button>
                            </form>
                        </div>
                    </div>
                ))}
            </section>
        </div>
    );
}
