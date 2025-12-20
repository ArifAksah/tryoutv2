import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Error params from Supabase redirect
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                // Sanitize options to prevent browser rejection
                const safeOptions = {
                  ...options,
                  // Ensure Path is root
                  path: '/',
                  // Force SameSite Lax for typical redirect flows
                  sameSite: 'lax' as const,
                  // Ensure Secure is true on production
                  secure: process.env.NODE_ENV === 'production',
                };

                // Remove domain to force "HostOnly" cookie (safest for Vercel)
                if (safeOptions.domain) {
                  delete safeOptions.domain;
                }

                console.log(`[Auth Callback] Setting Cookie: ${name} (Size: ${value.length})`);
                cookieStore.set(name, value, safeOptions);
              });
            } catch (error) {
              console.error("[Auth Callback] Failed to set credentials:", error);
            }
          },
        },
      }
    );

    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

    if (!sessionError) {
      // Support for load balancers / Vercel deployment URLs
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';

      console.log("[Auth Callback] Session exchanged successfully. Cookies set.");

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } else {
      console.error("Auth callback exchange error:", sessionError);
      // Fallthrough to error handling
    }
  }

  // Login page with error
  const loginUrl = new URL("/login", origin);
  if (error) loginUrl.searchParams.set("error", error);
  if (errorDescription) loginUrl.searchParams.set("error_description", errorDescription);
  if (!error && !code) loginUrl.searchParams.set("error", "no_code");

  loginUrl.searchParams.set("next", next); // Preserve next param

  return NextResponse.redirect(loginUrl);
}
