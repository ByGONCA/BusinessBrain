import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a client-side Supabase instance.
 * Safe for use in Client Components ('use client').
 * Automatically synchronizes auth state across tabs using browser cookies.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables."
    );
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
