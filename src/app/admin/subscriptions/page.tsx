import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { updateSubscriptionStatus } from "./actions";

export const dynamic = "force-dynamic";

type SubscriptionRow = {
    id: string;
    created_at: string;
    status: string;
    proof_of_payment: string | null;
    plan: { title: string; price: number } | null;
    user_profiles: { display_name: string | null; username: string | null } | null; // Note: Joined table name might be user_profiles
};

export default async function AdminSubscriptionsPage() {
    await requireAdminUser("/admin/subscriptions");

    const supabase = await getSupabaseServerClient("read");
    const { data, error } = await supabase
        .from("user_subscriptions")
        .select(`
      id, created_at, status, proof_of_payment,
      plan:subscription_plans(title, price),
      user_profiles(display_name, username)
    `)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching subscriptions:", error);
    }

    const subscriptions = (data ?? []) as unknown as SubscriptionRow[];

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</p>
                <h1 className="text-2xl font-bold text-slate-900">Langganan User</h1>
                <p className="text-sm text-slate-700">
                    Setujui atau tolak permintaan langganan user.
                </p>
            </div>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Tanggal</th>
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Paket</th>
                                <th className="px-4 py-3">Bukti / Info</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {subscriptions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                        Belum ada data langganan.
                                    </td>
                                </tr>
                            ) : (
                                subscriptions.map((sub) => (
                                    <tr key={sub.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {new Date(sub.created_at).toLocaleDateString("id-ID", {
                                                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-900">
                                                {sub.user_profiles?.display_name ?? "Unknown"}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                @{sub.user_profiles?.username ?? "username"}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-slate-900">{sub.plan?.title ?? "Unknown Plan"}</p>
                                            <p className="text-xs text-emerald-600">
                                                Rp {(sub.plan?.price ?? 0).toLocaleString("id-ID")}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 max-w-[200px] truncate" title={sub.proof_of_payment ?? ""}>
                                            {sub.proof_of_payment ? (
                                                sub.proof_of_payment.startsWith("http") ? (
                                                    <a href={sub.proof_of_payment} target="_blank" rel="noreferrer" className="text-indigo-600 underline">
                                                        Lihat Link
                                                    </a>
                                                ) : (
                                                    sub.proof_of_payment
                                                )
                                            ) : "-"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize
                            ${sub.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                                                    sub.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                                                        'bg-amber-100 text-amber-800'}`}>
                                                {sub.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {sub.status === "waiting" && (
                                                <div className="flex justify-end gap-2">
                                                    <form action={updateSubscriptionStatus}>
                                                        <input type="hidden" name="id" value={sub.id} />
                                                        <input type="hidden" name="status" value="approved" />
                                                        <button className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                                                            Approve
                                                        </button>
                                                    </form>
                                                    <form action={updateSubscriptionStatus}>
                                                        <input type="hidden" name="id" value={sub.id} />
                                                        <input type="hidden" name="status" value="rejected" />
                                                        <button className="rounded border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                                                            Reject
                                                        </button>
                                                    </form>
                                                </div>
                                            )}
                                            {sub.status !== "waiting" && (
                                                <form action={updateSubscriptionStatus}>
                                                    <input type="hidden" name="id" value={sub.id} />
                                                    {/* Hidden ability to reset to waiting if needed, or just change status back */}
                                                    <input type="hidden" name="status" value="waiting" />
                                                    <button className="text-xs text-slate-400 hover:text-indigo-600 hover:underline">
                                                        Reset
                                                    </button>
                                                </form>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
