"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export async function subscribeToPlan(formData: FormData) {
    const user = await getCurrentUser();
    if (!user) {
        redirect("/login?next=/pricing");
    }

    const planId = formData.get("plan_id")?.toString();
    if (!planId) return;

    const supabase = await getSupabaseServerClient("write");

    // Check existing
    const { data: existing } = await supabase
        .from("user_subscriptions")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("plan_id", planId)
        .single();

    if (existing) {
        // If rejected, allow re-apply
        if (existing.status === "rejected") {
            await supabase
                .from("user_subscriptions")
                .update({
                    status: "waiting",
                    updated_at: new Date().toISOString()
                })
                .eq("id", existing.id);
        }
        // If waiting or approved, do nothing (idempotent)
    } else {
        // Create new
        await supabase.from("user_subscriptions").insert({
            user_id: user.id,
            plan_id: planId,
            status: "waiting"
        });
    }

    revalidatePath("/pricing");
    revalidatePath("/"); // Update dashboard too
}
