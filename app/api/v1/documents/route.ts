import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { isPublicApiEnabled, publicApiUnavailableResponse } from "@/lib/api-keys/feature-flag";

export async function GET(req: Request) {
  if (!isPublicApiEnabled()) {
    return publicApiUnavailableResponse();
  }

  const auth = await authenticateApiKey(req, "read:documents");
  if (!auth.authenticated) {
    return auth.response;
  }

  const supabase = createServiceClient();
  const { data: pages, error } = await supabase
    .from("pages")
    .select("id, title, icon, is_archived, created_at, updated_at")
    .eq("organization_id", auth.context.organizationId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500, headers: auth.headers }
    );
  }

  return NextResponse.json(
    {
      organizationId: auth.context.organizationId,
      documents: pages || [],
    },
    { headers: auth.headers }
  );
}

export async function POST(req: Request) {
  if (!isPublicApiEnabled()) {
    return publicApiUnavailableResponse();
  }

  const auth = await authenticateApiKey(req, "write:documents");
  if (!auth.authenticated) {
    return auth.response;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON payload" },
      { status: 400, headers: auth.headers }
    );
  }

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json(
      { error: "Bad Request", message: "Title is required" },
      { status: 400, headers: auth.headers }
    );
  }

  const supabase = createServiceClient();
  const { data: page, error } = await supabase
    .from("pages")
    .insert({
      organization_id: auth.context.organizationId,
      title,
      icon: body.icon || "📄",
      content: body.content || { blocks: [] },
    })
    .select("id, title, icon, created_at, updated_at")
    .single();

  if (error || !page) {
    return NextResponse.json(
      { error: "Internal Server Error", message: error?.message || "Failed to create document" },
      { status: 500, headers: auth.headers }
    );
  }

  return NextResponse.json({ document: page }, { status: 201, headers: auth.headers });
}
