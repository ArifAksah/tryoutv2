
"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function signInWithGoogleAction(nextPath: string = "/") {
    const supabase = await getSupabaseServerClient("write");
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https";

    // Ensure redirect URL points to the correct Vercel domain or localhost
    const origin = `${protocol}://${host}`;
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo,
            // queryParams: { access_type: 'offline', prompt: 'consent' }, // Optional
        },
    });

    if (error) {
        return { error: error.message };
    }

    if (data.url) {
        redirect(data.url);
    }
}
