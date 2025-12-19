import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const cookieCount = request.cookies.getAll().length;
  console.log(`Middleware start: ${request.nextUrl.pathname}, Cookies found: ${cookieCount}`);

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Avoid refreshing auth session on prefetch requests to prevent race conditions
  // that trigger Supabase's "Token Reuse Detection".
  const isPrefetch = request.headers.get("purpose") === "prefetch";

  console.log(`[Middleware] Path: ${request.nextUrl.pathname}, Prefetch: ${isPrefetch}`);
  // Debug Headers for Desktop analysis
  // if (request.nextUrl.pathname.startsWith('/')) {
  //    const h = Object.fromEntries(request.headers.entries());
  //    console.log('[Middleware Headers]', JSON.stringify(h));
  // }

  if (!isPrefetch) {
    // Keeps the auth session fresh and ensures cookies are synced.
    const { error } = await supabase.auth.getUser();
    if (error) {
      console.error(`[Middleware] Auth error:`, error.message);
    }
  } else {
    // console.log(`Skipping auth refresh for prefetch: ${request.nextUrl.pathname}`);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
