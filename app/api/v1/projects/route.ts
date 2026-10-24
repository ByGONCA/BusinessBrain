import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { isPublicApiEnabled, publicApiUnavailableResponse } from "@/lib/api-keys/feature-flag";

export async function GET(req: Request) {
  if (!isPublicApiEnabled()) {
    return publicApiUnavailableResponse();
  }

  const auth = await authenticateApiKey(req, "read:projects");
  if (!auth.authenticated) {
    return auth.response;
  }

  const supabase = createServiceClient();
  const { data: entities, error } = await supabase
    .from("company_entities")
    .select("id, title, content, metadata, created_at, updated_at")
    .eq("organization_id", auth.context.organizationId)
    .eq("type", "project")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500, headers: auth.headers }
    );
  }

  const projects = (entities || []).map((entity) => {
    const meta = (entity.metadata as Record<string, unknown>) || {};
    return {
      id: entity.id,
      name: entity.title,
      description: entity.content || (meta.description as string) || "",
      status: (meta.status as string) || "active",
      priority: (meta.priority as string) || "medium",
      target_date: (meta.target_date as string) || null,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  });

  return NextResponse.json(
    {
      organization: {
        id: auth.context.organizationId,
        name: auth.context.organizationName,
      },
      projects,
    },
    { headers: auth.headers }
  );
}
