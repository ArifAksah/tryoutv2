import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Checks if a user has access to a specific exam package.
 * Access is granted if:
 * 1. The package is NOT linked to any subscription plan (Public/Free).
 * 2. OR The user has an ACTIVE subscription to a plan that includes this package.
 */
export async function checkPackageAccess(userId: string | undefined, packageId: string): Promise<{ allowed: boolean; reason?: "login_required" | "subscription_required" }> {
    const supabase = await getSupabaseServerClient("read");

    // 1. Check if the package is restricted (has any entitlements)
    const { count, error } = await supabase
        .from("subscription_plan_entitlements")
        .select("*", { count: "exact", head: true })
        .eq("target_id", packageId)
        .eq("entitlement_type", "exam_package");

    // If no entitlements found, it's open to everyone
    if (count === 0) {
        return { allowed: true };
    }

    // If restricted, user must be logged in
    if (!userId) {
        return { allowed: false, reason: "login_required" };
    }

    // 2. Check if user has an active subscription that covers this package
    // We join user_subscriptions -> subscription_plan_entitlements
    const { data } = await supabase
        .from("user_subscriptions")
        .select(`
            id,
            status,
            plan_id,
            plan:subscription_plans (
                entitlements:subscription_plan_entitlements (
                    target_id
                )
            )
        `)
        .eq("user_id", userId)
        .eq("status", "approved");

    const userSubs = data || [];

    const hasAccess = userSubs.some(sub => {
        // sub.plan is a single object or null
        // sub.plan.entitlements is an array of entitlements
        const plan = sub.plan as any;
        if (!plan || !Array.isArray(plan.entitlements)) return false;

        return plan.entitlements.some((e: any) => e.target_id === packageId);
    });

    if (hasAccess) {
        return { allowed: true };
    }

    return { allowed: false, reason: "subscription_required" };
}
