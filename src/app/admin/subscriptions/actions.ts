"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";

export async function updateSubscriptionStatus(formData: FormData) {
    const is_admin = await isAdminUser();
    if (!is_admin) throw new Error("Unauthorized");

    const id = formData.get("id")?.toString();
    const status = formData.get("status")?.toString();

    if (!id || !status) {
        throw new Error("Missing id or status");
    }

    // Validate status
    if (!["approved", "rejected", "waiting"].includes(status)) {
        throw new Error("Invalid status");
    }

    const supabase = await getSupabaseServerClient("write");

    const { error } = await supabase
        .from("user_subscriptions")
        .update({
            status,
            updated_at: new Date().toISOString()
        })
        .eq("id", id);

    if (error) {
        console.error("updateSubscriptionStatus error", error);
        throw new Error(error.message);
    }

    revalidatePath("/admin/subscriptions");
}
