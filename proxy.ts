import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isPublicApiEnabled, publicApiUnavailableResponse } from "@/lib/api-keys/feature-flag";

export async function proxy(request: NextRequest) {
  // Block all external access to Enterprise Public API (/api/v1/*) when disabled by default
  if (request.nextUrl.pathname.startsWith("/api/v1") && !isPublicApiEnabled()) {
    return publicApiUnavailableResponse();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next (Next.js internals, static files, chunks, HMR)
     * - favicon.ico (favicon file)
     * - api/webhooks (webhook endpoints)
     * - public folder static files (images, svgs, fonts, stylesheets, scripts)
     */
    "/((?!_next|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ico|css|js|map)$).*)",
  ],
};
