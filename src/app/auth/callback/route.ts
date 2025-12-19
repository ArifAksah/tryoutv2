import { NextResponse, type NextRequest } from "next/server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const safeNext = next.startsWith("/") ? next : "/";

  if (error) {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("next", safeNext);
    loginUrl.searchParams.set("error", error);
    if (errorDescription) loginUrl.searchParams.set("error_description", errorDescription);
    return NextResponse.redirect(loginUrl);
  }

  const redirectUrl = new URL(safeNext, url.origin);
  const response = NextResponse.redirect(redirectUrl);

  if (!code) {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Auth callback failed: Missing Supabase environment variables in Vercel.");
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("Auth callback exchange error:", exchangeError);
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("next", safeNext);
    loginUrl.searchParams.set("error", "oauth_exchange_failed");
    loginUrl.searchParams.set("error_description", exchangeError.message);
    return NextResponse.redirect(loginUrl);
  }

  console.log("Auth callback success. Redirecting to:", safeNext);

  return response;
}
