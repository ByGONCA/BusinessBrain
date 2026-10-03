import { NextResponse } from "next/server";
import { getUserOrganizations } from "@/lib/organizations/queries";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

/**
 * GET /api/organizations
 * Returns the list of organizations the authenticated user belongs to.
 * Protected with authentication and rate limiting.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await rateLimit("get-organizations", user.id, RATE_LIMIT_PRESETS.API_STANDARD);
    if (!rl.success) {
      logger.warn("Rate limit exceeded on get organizations", { userId: user.id });
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const organizations = await getUserOrganizations();
    return NextResponse.json({ organizations });
  } catch (err: unknown) {
    logger.error("Error fetching organizations", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
