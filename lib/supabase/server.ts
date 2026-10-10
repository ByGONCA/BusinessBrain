import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import dns from "node:dns";

// Ensure Node.js prefers IPv4 resolution to prevent Windows dual-stack IPv6 routing failures ("TypeError: fetch failed")
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Ignore in environments where setDefaultResultOrder is not supported
}

function getSupabaseCredentials() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables."
    );
  }

  return { supabaseUrl, supabasePublishableKey };
}

/**
 * Resilient fetch wrapper for Supabase clients.
 * Retries once on transient socket/network drops and provides clear diagnostics.
 */
async function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err: unknown) {
    const errorObj = err as { message?: string; cause?: unknown };
    // Only retry on network errors
    if (errorObj?.message === "fetch failed") {
      try {
        return await fetch(input, init);
      } catch {
        // Re-throw original error if retry fails
        throw err;
      }
    }
    throw err;
  }
}

/**
 * Creates a server-side Supabase client for Server Components, Server Actions, and Route Handlers.
 * Memoized per request using React cache() to prevent redundant client instantiation.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  const { supabaseUrl, supabasePublishableKey } = getSupabaseCredentials();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    global: {
      fetch: supabaseFetch,
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
});

/**
 * Retrieves the current authenticated user, memoized per request.
 * Eliminates redundant remote auth calls across layout and page server components.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Creates a standalone server-side Supabase client without cookie dependency.
 * Suitable for webhook endpoints and background route handlers.
 * Prioritizes SUPABASE_SERVICE_ROLE_KEY when available to execute privileged operations
 * within the secure service_role boundary.
 */
export function createServiceClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseCredentials();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || supabasePublishableKey;

  return createJsClient(supabaseUrl, serviceKey, {
    global: {
      fetch: supabaseFetch,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
