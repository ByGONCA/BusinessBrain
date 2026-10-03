import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
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
