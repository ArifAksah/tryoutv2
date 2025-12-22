import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { EntitlementManager } from "./_components/entitlement-manager";

type Props = {
    params: Promise<{ id: string }>;
};

export default async function PlanEntitlementsPage({ params }: Props) {
    await requireAdminUser();
    const { id } = await params;

    const supabase = await getSupabaseServerClient("read");

    // Fetch Plan
    const { data: plan } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("id", id)
        .single();

    if (!plan) return notFound();

    // Fetch All Exam Packages (to select from)
    const { data: packages } = await supabase
        .from("exam_packages")
        .select("id, title, slug, is_active")
        .order("title");

    // Fetch Existing Entitlements
    const { data: entitlements } = await supabase
        .from("subscription_plan_entitlements")
        .select("*")
        .eq("plan_id", id);

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Link href="/admin/plans" className="hover:text-indigo-600 hover:underline">Paket Berlangganan</Link>
                    <span>/</span>
                    <span>Kelola Konten</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Konten Paket: {plan.title}</h1>
                <p className="text-sm text-slate-700">
                    Pilih paket tryout yang bisa diakses oleh pelanggan paket ini.
                </p>
            </div>

            <EntitlementManager
                planId={id}
                allPackages={packages ?? []}
                existingEntitlements={entitlements ?? []}
            />
        </div>
    );
}
