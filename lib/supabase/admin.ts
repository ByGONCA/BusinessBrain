import { createServiceClient } from "./server";

/**
 * @deprecated Standalone server client.
 * Uses NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and PostgreSQL SECURITY DEFINER RPCs
 * instead of a service role key.
 */
export function createAdminClient() {
  return createServiceClient();
}
