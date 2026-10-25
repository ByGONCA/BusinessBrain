import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/verify-email";
  return NextResponse.redirect(url);
}
