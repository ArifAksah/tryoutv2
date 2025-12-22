"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";

export async function upsertPlan(formData: FormData) {
    const is_admin = await isAdminUser();
    if (!is_admin) throw new Error("Unauthorized");

    const id = formData.get("id")?.toString();
    const title = formData.get("title")?.toString();
    if (!title) throw new Error("Title is required");

    const description = formData.get("description")?.toString();
    const price = Number(formData.get("price") ?? 0);
    const is_active = formData.get("is_active") === "on";

    const featuresText = formData.get("features")?.toString() ?? "";
    const features = featuresText.split("\n").map(s => s.trim()).filter(Boolean);

    const supabase = await getSupabaseServerClient("write");

    const payload = {
        title,
        description,
        price,
        features,
        is_active,
        updated_at: new Date().toISOString(),
    };

    let error;
    if (id) {
        const { error: e } = await supabase.from("subscription_plans").update(payload).eq("id", id);
        error = e;
    } else {
        const { error: e } = await supabase.from("subscription_plans").insert(payload);
        error = e;
    }

    if (error) {
        console.error("upsertPlan error", error);
        throw new Error(error.message);
    }

    revalidatePath("/admin/plans");
    if (!id) {
        // If new, maybe redirect to clear form? Or just revalidate
        // redirect("/admin/plans");
    }
}

export async function deletePlan(formData: FormData) {
    const is_admin = await isAdminUser();
    if (!is_admin) throw new Error("Unauthorized");

    const id = formData.get("id")?.toString();
    if (!id) return;

    const supabase = await getSupabaseServerClient("write");
    await supabase.from("subscription_plans").delete().eq("id", id);

    revalidatePath("/admin/plans");
}
