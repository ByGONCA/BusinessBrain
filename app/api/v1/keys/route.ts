import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { hasPermission } from "@/lib/permissions/resolver";
import { authenticateApiKey } from "@/lib/api-keys/auth";
import { generateApiKey, listApiKeys } from "@/lib/api-keys/service";
import { ApiKeyScope } from "@/lib/api-keys/types";
import { isPublicApiEnabled, publicApiUnavailableResponse } from "@/lib/api-keys/feature-flag";

async function resolveAdminOrgId(req: Request): Promise<{ organizationId: string; userId?: string } | null> {
  const authHeader = req.headers.get("authorization");

  if (authHeader && authHeader.startsWith("Bearer cb_live_")) {
    const auth = await authenticateApiKey(req, "admin");
    if (auth.authenticated) {
      return { organizationId: auth.context.organizationId };
    }
  }

  const user = await getCurrentUser();
  if (!user) return null;

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) return null;

  const canManage = await hasPermission(user.id, activeOrg.id, "settings.manage");
  if (!canManage) return null;

  return { organizationId: activeOrg.id, userId: user.id };
}

export async function GET(req: Request) {
  if (!isPublicApiEnabled()) {
    return publicApiUnavailableResponse();
  }

  const auth = await resolveAdminOrgId(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized or insufficient permissions" }, { status: 401 });
  }

  const keys = await listApiKeys(auth.organizationId);
  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  if (!isPublicApiEnabled()) {
    return publicApiUnavailableResponse();
  }

  const auth = await resolveAdminOrgId(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized or insufficient permissions" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Key name is required" }, { status: 400 });
  }

  const scopes: ApiKeyScope[] = Array.isArray(body.scopes) && body.scopes.length > 0 ? body.scopes : ["read:projects"];

  try {
    const result = await generateApiKey(auth.organizationId, name, scopes, {
      createdByUserId: auth.userId,
      rateLimitPerMinute: body.rateLimitPerMinute,
      expiresInDays: body.expiresInDays,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate key" }, { status: 500 });
  }
}
