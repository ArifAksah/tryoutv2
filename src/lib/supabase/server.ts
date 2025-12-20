import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export type SupabaseServerClientMode = "read" | "write";

export function hasSupabasePublicEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function getSupabaseServerClient(mode: SupabaseServerClientMode = "read") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        const allCookies = cookieStore.getAll();
        const activeUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "MISSING";

        // Derive expected cookie name logic (simplified from supabase-js)
        let expectedName = "unknown";
        try {
          const urlObj = new URL(activeUrl);
          const hostname = urlObj.hostname;
          // Usually projectId is the first part of hostname
          const projectId = hostname.split('.')[0];
          expectedName = `sb-${projectId}-auth-token`;
        } catch (e) {
          console.error("[DEBUG] Failed to parse Supabase URL:", e);
        }

        const found = allCookies.filter(c => c.name === expectedName);

        console.log(`[DEBUG] Supabase URL: ${activeUrl}`);
        console.log(`[DEBUG] Expected Cookie Name: ${expectedName}`);
        console.log(`[DEBUG] Cookies Match Count: ${found.length}`);

        if (found.length > 1) {
          console.error(`[CRITICAL] DUPLICATE COOKIES DETECTED! Use Clear Site Data. Values:`, found.map(c => c.value.substring(0, 10) + '...'));
        } else if (found.length === 1) {
          console.log(`[DEBUG] Cookie found: ${found[0].name} (Size: ${found[0].value.length})`);
        } else {
          // console.log(`[DEBUG] No auth cookie found.`);
        }

        return allCookies;
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        if (mode !== "write") return;
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            const safeOptions = {
              ...options,
              path: '/',
              sameSite: 'lax' as const,
              secure: process.env.NODE_ENV === 'production',
            };

            if (safeOptions.domain) {
              delete safeOptions.domain;
            }

            cookieStore.set(name, value, safeOptions);
          });
        } catch (error) {
          // Ignore errors in server components where cookies can't be set
          // (This happens when getUser() refeshes tokens in a Server Component)
        }
      },
    },
  });
}
