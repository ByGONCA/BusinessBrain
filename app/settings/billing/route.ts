import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
  return NextResponse.redirect(`${baseUrl}/dashboard?settings=billing`);
}
