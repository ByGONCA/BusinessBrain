import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { isPublicApiEnabled, publicApiUnavailableResponse } from "@/lib/api-keys/feature-flag";

export async function GET(req: Request) {
  if (!isPublicApiEnabled()) {
    return publicApiUnavailableResponse();
  }

  const auth = await authenticateApiKey(req, "read:discussions");
  if (!auth.authenticated) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");

  const supabase = createServiceClient();
  let query = supabase
    .from("external_discussions")
    .select("id, provider, external_id, channel_or_repo, title, body, author_name, external_url, metadata, created_at")
    .eq("organization_id", auth.context.organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (provider) {
    query = query.eq("provider", provider);
  }

  const { data: discussions, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500, headers: auth.headers }
    );
  }

  return NextResponse.json(
    {
      organizationId: auth.context.organizationId,
      discussions: discussions || [],
    },
    { headers: auth.headers }
  );
}
