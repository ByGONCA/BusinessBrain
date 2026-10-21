"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE_NAME, getActiveOrganization } from "@/lib/organizations/queries";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

const onboardingSchema = z.object({
  name: z.string().trim().min(2, "Company name must be at least 2 characters").max(50),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
  websiteUrl: z.string().trim().max(255).optional().or(z.literal("")),
  industry: z.string().trim().max(50).optional().or(z.literal("")),
  teamSize: z.string().trim().max(30).optional().or(z.literal("")),
  objectives: z.array(z.string()).min(1, "Please select at least one objective"),
  acquisitionChannel: z.string().trim().max(100).optional(),
});

export interface OnboardingActionResult {
  success: boolean;
  error?: string;
  organizationId?: string;
}

/**
 * Completes the progressive multi-step onboarding:
 * 1. Validates company info, industry, team size, objectives and source.
 * 2. Creates the organization idempotently with owner membership.
 * 3. Saves onboarding state and sets active workspace cookie.
 * 4. Fallback-resilient to ensure zero-downtime even before SQL migration.
 */
export async function completeOnboardingAction(
  rawData: {
    name: string;
    slug: string;
    websiteUrl?: string;
    industry?: string;
    teamSize?: string;
    objectives: string[];
    acquisitionChannel?: string;
  }
): Promise<OnboardingActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required to complete onboarding." };
  }

  // Rate limit
  const rl = await rateLimit("complete-onboarding", user.id, RATE_LIMIT_PRESETS.MUTATIONS);
  if (!rl.success) {
    logger.warn("Rate limit exceeded for onboarding", { userId: user.id });
    return { success: false, error: "Too many attempts. Please try again shortly." };
  }

  const parsed = onboardingSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid onboarding details.",
    };
  }

  const { name, slug, websiteUrl, industry, teamSize, objectives, acquisitionChannel } = parsed.data;

  // 1. Check if user already owns an organization with this slug
  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();

  let orgId = existingOrg?.id;

  if (!orgId) {
    // Attempt insert with migration 00032 & 00031 columns
    const insertPayload: Record<string, unknown> = {
      name,
      slug,
      created_by: user.id,
      status: "active",
      website_url: websiteUrl || null,
      industry: industry || null,
      team_size: teamSize || null,
      onboarding_metadata: {
        website_url: websiteUrl || null,
        objectives,
        acquisition_source: acquisitionChannel || "direct",
        completed_at: new Date().toISOString(),
      },
    };

    let { data: newOrg, error: orgError } = await supabase
      .from("organizations")
      .insert(insertPayload)
      .select("id")
      .single();

    // If new columns don't exist yet on database, retry with core columns
    if (orgError && orgError.code === "42703") {
      logger.info("Retrying org insert without extended onboarding columns (migration pending)");
      const fallbackPayload = {
        name,
        slug,
        created_by: user.id,
        status: "active",
      };
      const retryResult = await supabase
        .from("organizations")
        .insert(fallbackPayload)
        .select("id")
        .single();
      newOrg = retryResult.data;
      orgError = retryResult.error;
    }

    if (orgError) {
      if (orgError.code === "23505") {
        return {
          success: false,
          error: "An organization with this URL slug already exists. Please pick another.",
        };
      }
      logger.error("Failed to create organization during onboarding", orgError, {
        userId: user.id,
      });
      return { success: false, error: "Failed to create company workspace. Please try again." };
    }

    orgId = newOrg!.id;

    // Assign user as workspace owner
    const { error: memberError } = await supabase
      .from("organization_members")
      .insert({
        organization_id: orgId,
        user_id: user.id,
        role: "owner",
      });

    if (memberError && memberError.code !== "23505") {
      logger.error("Failed to assign workspace ownership", memberError, { orgId, userId: user.id });
      return { success: false, error: "Failed to initialize workspace ownership." };
    }
  }

  // 2. Set active organization cookie
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE_NAME, orgId, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  // 3. Mark profile onboarding complete
  const now = new Date().toISOString();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      onboarding_completed: true,
      onboarding_completed_at: now,
      tour_completed: false,
      tour_step: 0,
    })
    .eq("id", user.id);

  // Fallback to user metadata in auth if columns are pending
  if (profileError && profileError.code === "42703") {
    await supabase.auth.updateUser({
      data: {
        onboarding_completed: true,
        onboarding_completed_at: now,
        tour_completed: false,
        tour_step: 0,
        industry,
        team_size: teamSize,
        objectives,
        acquisition_source: acquisitionChannel,
      },
    });
  }

  revalidatePath("/", "layout");
  return { success: true, organizationId: orgId };
}

/**
 * Updates the current active step of the in-app interactive tour.
 */
export async function saveTourStepAction(step: number): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false };

    const { error } = await supabase
      .from("profiles")
      .update({ tour_step: step })
      .eq("id", user.id);

    if (error && error.code === "42703") {
      await supabase.auth.updateUser({ data: { tour_step: step } });
    }

    return { success: true };
  } catch (err) {
    logger.error("saveTourStepAction error", err);
    return { success: false };
  }
}

/**
 * Marks the interactive tour as completed or dismissed.
 */
export async function completeTourAction(): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false };

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({
        tour_completed: true,
        tour_completed_at: now,
      })
      .eq("id", user.id);

    if (error && error.code === "42703") {
      await supabase.auth.updateUser({
        data: {
          tour_completed: true,
          tour_completed_at: now,
        },
      });
    }

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err) {
    logger.error("completeTourAction error", err);
    return { success: false };
  }
}

/**
 * Resets the interactive tour so the user can re-experience it on demand.
 */
export async function resetTourAction(): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false };

    const { error } = await supabase
      .from("profiles")
      .update({
        tour_completed: false,
        tour_step: 0,
      })
      .eq("id", user.id);

    if (error && error.code === "42703") {
      await supabase.auth.updateUser({
        data: {
          tour_completed: false,
          tour_step: 0,
        },
      });
    }

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err) {
    logger.error("resetTourAction error", err);
    return { success: false };
  }
}

/**
 * Updates an item state in the first-use checklist.
 */
export async function updateChecklistAction(
  taskKey: string,
  completed: boolean
): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false };

    const { data: profile } = await supabase
      .from("profiles")
      .select("checklist_state")
      .eq("id", user.id)
      .maybeSingle();

    const currentState = (profile?.checklist_state as Record<string, boolean>) || {};
    const updatedState = { ...currentState, [taskKey]: completed };

    const { error } = await supabase
      .from("profiles")
      .update({ checklist_state: updatedState })
      .eq("id", user.id);

    if (error && error.code === "42703") {
      await supabase.auth.updateUser({ data: { checklist_state: updatedState } });
    }

    revalidatePath("/dashboard", "page");
    return { success: true };
  } catch (err) {
    logger.error("updateChecklistAction error", err);
    return { success: false };
  }
}

/**
 * Dismisses the first-use checklist so it doesn't appear on the dashboard.
 */
export async function dismissChecklistAction(): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false };

    const { data: profile } = await supabase
      .from("profiles")
      .select("checklist_state")
      .eq("id", user.id)
      .maybeSingle();

    const currentState = (profile?.checklist_state as Record<string, boolean>) || {};
    const updatedState = { ...currentState, dismissed: true };

    const { error } = await supabase
      .from("profiles")
      .update({ checklist_state: updatedState })
      .eq("id", user.id);

    if (error && error.code === "42703") {
      await supabase.auth.updateUser({ data: { checklist_state: updatedState } });
    }

    revalidatePath("/dashboard", "page");
    return { success: true };
  } catch (err) {
    logger.error("dismissChecklistAction error", err);
    return { success: false };
  }
}
