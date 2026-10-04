"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE_NAME, getActiveOrganization, getOrganizationMembers } from "./queries";
import { OrganizationMember } from "./types";
import { isValidUuid } from "@/lib/security/authorization";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

const createOrgSchema = z.object({
  name: z.string().trim().min(2, "Company name must be at least 2 characters").max(50),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
});

export interface ActionState {
  error?: string;
  success?: boolean;
}

/**
 * Creates a new organization, assigns creator as owner, and sets it as the active organization.
 */
export async function createOrganizationAction(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required to create a workspace." };
  }

  // Rate limit workspace creations per user
  const rl = await rateLimit("create-org", user.id, RATE_LIMIT_PRESETS.MUTATIONS);
  if (!rl.success) {
    logger.warn("Rate limit exceeded for organization creation", { userId: user.id });
    return { error: "Too many organizations created. Please try again later." };
  }

  const rawData = {
    name: formData.get("name"),
    slug: formData.get("slug"),
  };

  const parsed = createOrgSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid organization details." };
  }

  const { name, slug } = parsed.data;

  // Insert organization
  const { data: orgData, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name,
      slug,
      created_by: user.id,
      status: "active",
    })
    .select("id")
    .single();

  if (orgError) {
    if (orgError.code === "23505") {
      return { error: "An organization with this slug already exists. Please choose another." };
    }
    logger.error("Failed to create organization in DB", orgError, { userId: user.id });
    return { error: "Failed to create organization. Please try again." };
  }

  // Insert membership record assigning user as owner
  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: orgData.id,
      user_id: user.id,
      role: "owner",
    });

  if (memberError) {
    logger.error("Failed to assign workspace ownership", memberError, {
      orgId: orgData.id,
      userId: user.id,
    });
    return { error: "Failed to assign workspace ownership." };
  }

  // Set active organization cookie
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE_NAME, orgData.id, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  revalidatePath("/", "layout");
  redirect("/pricing");
}

/**
 * Switches the user's active organization after verifying membership and UUID format.
 */
export async function switchOrganizationAction(organizationId: string) {
  // Validate UUID format to prevent injection attacks or invalid lookup errors
  if (!isValidUuid(organizationId)) {
    throw new Error("Invalid organization identifier format.");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify the user is actually a member of the requested organization
  const { data: member, error } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !member) {
    logger.warn("Unauthorized attempt to switch organization", {
      userId: user.id,
      organizationId,
    });
    throw new Error("Unauthorized to access this workspace.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE_NAME, organizationId, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/dashboard", "layout");
}

/**
 * Fetches organization members on-demand for modals and settings.
 */
export async function getOrganizationMembersAction(
  organizationId?: string
): Promise<{ success: boolean; members: OrganizationMember[]; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, members: [], error: "Unauthorized" };
    }

    let targetOrgId = organizationId;

    if (targetOrgId) {
      // Defense-in-depth: when an explicit organizationId is supplied by the caller,
      // verify the authenticated user is actually a member before returning any data.
      if (!isValidUuid(targetOrgId)) {
        return { success: false, members: [], error: "Invalid organization identifier" };
      }
      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", targetOrgId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (membershipError || !membership) {
        logger.warn("getOrganizationMembersAction: caller is not a member of the requested org", {
          userId: user.id,
          organizationId: targetOrgId,
        });
        return { success: false, members: [], error: "Unauthorized to access this workspace" };
      }
    } else {
      const activeOrg = await getActiveOrganization();
      targetOrgId = activeOrg?.id;
    }

    if (!targetOrgId) {
      return { success: false, members: [], error: "No active workspace found" };
    }

    const members = await getOrganizationMembers(targetOrgId);
    return { success: true, members };
  } catch (err: unknown) {
    logger.error("Error in getOrganizationMembersAction", err);
    return { success: false, members: [], error: "Failed to fetch workspace members" };
  }
}
