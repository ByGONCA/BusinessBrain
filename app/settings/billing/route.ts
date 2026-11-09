import { NextResponse } from "next/server";
import { getTrustedAppUrl } from "@/lib/security/redirects";

export async function GET(request: Request) {
  const baseUrl = getTrustedAppUrl(request);
  return NextResponse.redirect(`${baseUrl}/dashboard?settings=billing`);
}
