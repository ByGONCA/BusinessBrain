import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { hasPermission } from "@/lib/permissions/resolver";
import { authenticateApiKey } from "@/lib/api-keys/auth";
import { revokeApiKey } from "@/lib/api-keys/service";
import { isPublicApiEnabled, publicApiUnavailableResponse } from "@/lib/api-keys/feature-flag";

async function resolveAdminOrgId(req: Request): Promise<{ organizationId: string } | null> {
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

  return { organizationId: activeOrg.id };
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isPublicApiEnabled()) {
    return publicApiUnavailableResponse();
  }

  const { id } = await params;
  const auth = await resolveAdminOrgId(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized or insufficient permissions" }, { status: 401 });
  }

  const success = await revokeApiKey(auth.organizationId, id);
  if (!success) {
    return NextResponse.json({ error: "Failed to revoke key or key not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, revokedId: id });
}
