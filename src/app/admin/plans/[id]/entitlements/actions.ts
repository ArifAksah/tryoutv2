"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function toggleEntitlement(planId: string, targetId: string, isChecked: boolean) {
    await requireAdminUser();
    const supabase = await getSupabaseServerClient("write");

    if (isChecked) {
        // Add entitlement
        await supabase.from("subscription_plan_entitlements").upsert({
            plan_id: planId,
            target_id: targetId,
            entitlement_type: "exam_package"
        }, { onConflict: "plan_id, target_id, entitlement_type" });
    } else {
        // Remove entitlement
        await supabase.from("subscription_plan_entitlements")
            .delete()
            .eq("plan_id", planId)
            .eq("target_id", targetId)
            .eq("entitlement_type", "exam_package");
    }

    revalidatePath(`/admin/plans/${planId}/entitlements`);
}
