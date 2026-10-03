import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  // If env vars are not configured yet during build/preview, bypass silently
  if (!supabaseUrl || !supabasePublishableKey) {
    return supabaseResponse;
  }

  const isAuthRoute =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/signup" ||
    request.nextUrl.pathname === "/forgot-password";

  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/onboarding") ||
    request.nextUrl.pathname.startsWith("/checkout");

  // Check if any Supabase session cookies exist
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-"));

  // Fast path 1: Unauthenticated request to protected route
  // If no auth cookies exist, redirect immediately to login without remote network delay
  if (!hasAuthCookie && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Fast path 2: Unauthenticated request to public route or auth route
  // If no auth cookies exist and route is public/auth, skip remote Supabase call completely
  if (!hasAuthCookie) {
    return supabaseResponse;
  }

  // Fast path 3: Speculative prefetch or RSC sub-navigation with existing auth cookies.
  // Client-side navigations send an RSC request (`rsc: 1`) or prefetch (`next-router-prefetch: 1`).
  // All protected routes (e.g., /dashboard/*) enforce authoritative server-side user & entitlement
  // checks in their Server Component layouts (via verifyAccessOrRedirect -> getCurrentUser).
  // Bypassing remote Supabase Auth roundtrips in middleware for internal RSC requests cuts 250-500ms
  // of pure network latency on every page transition and avoids prefetch connection saturation.
  const acceptHeader = request.headers.get("accept") || "";
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose") === "prefetch";
  const isRsc =
    request.headers.get("rsc") === "1" ||
    acceptHeader.includes("text/x-component") ||
    request.headers.has("next-router-state-tree");

  if (hasAuthCookie && (isPrefetch || (isRsc && isProtectedRoute))) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Only authenticate/refresh session when auth cookies are present
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users from protected routes to login
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth entry pages to dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
