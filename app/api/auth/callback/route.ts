import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserOrganizations, getActiveOrganization } from "@/lib/organizations/queries";
import { getOrganizationEntitlement } from "@/lib/organizations/entitlements";
import { sanitizeRedirectUrl } from "@/lib/security/redirects";
import { rateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

export async function GET(request: Request) {
  const clientIp = await getClientIp();
  const rl = await rateLimit("auth-callback", clientIp, RATE_LIMIT_PRESETS.AUTH_STRICT);

  const { searchParams, origin } = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;

  if (!rl.success) {
    logger.warn("Rate limit exceeded on auth callback", { clientIp });
    return NextResponse.redirect(`${baseUrl}/login?error=too-many-requests`);
  }

  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const safeNext = sanitizeRedirectUrl(rawNext, "/dashboard");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user has an organization
      const organizations = await getUserOrganizations();

      if (organizations.length === 0) {
        return NextResponse.redirect(`${baseUrl}/onboarding`);
      }

      // If safeNext is an explicit auth recovery route (like /reset-password), prioritize it
      if (safeNext.startsWith("/reset-password")) {
        return NextResponse.redirect(`${baseUrl}${safeNext}`);
      }

      // Check active organization entitlement
      const activeOrg = await getActiveOrganization();
      if (activeOrg) {
        const entitlement = await getOrganizationEntitlement(activeOrg.id);
        if (!entitlement.isEntitled) {
          return NextResponse.redirect(`${baseUrl}/pricing?reason=subscription_required`);
        }
      }

      return NextResponse.redirect(`${baseUrl}${safeNext}`);
    } else {
      logger.warn("Supabase auth code exchange failed", { error: error.message });
    }
  }

  // Return the user to login with sanitized error parameter
  return NextResponse.redirect(`${baseUrl}/login?error=auth-code-error`);
}
