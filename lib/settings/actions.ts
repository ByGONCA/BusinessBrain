"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/security/logger";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

const emailSchema = z.string().trim().email("Please provide a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export interface SettingsActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Resends the signup confirmation email to the current user if not yet confirmed.
 */
export async function resendVerificationEmailAction(): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { success: false, error: "Authentication required." };
  }

  // Rate limit
  const rl = await rateLimit("resend-verify", user.id, RATE_LIMIT_PRESETS.AUTH_STRICT);
  if (!rl.success) {
    return { success: false, error: "Please wait a few minutes before requesting another verification email." };
  }

  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
    });

    if (error) {
      logger.warn("Failed to resend confirmation email", { error: error.message, userId: user.id });
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: `A verification link has been sent to ${user.email}.`,
    };
  } catch (err) {
    logger.error("Exception during resendVerificationEmail", err, { userId: user.id });
    return { success: false, error: "Unable to resend verification email." };
  }
}

/**
 * Updates the user's primary email address. Supabase Auth will dispatch confirmation emails.
 */
export async function updateEmailAddressAction(newEmail: string): Promise<SettingsActionResult> {
  const parsed = emailSchema.safeParse(newEmail);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  if (user.email?.toLowerCase() === parsed.data.toLowerCase()) {
    return { success: false, error: "This is already your active email address." };
  }

  const rl = await rateLimit("update-email", user.id, RATE_LIMIT_PRESETS.AUTH_STRICT);
  if (!rl.success) {
    return { success: false, error: "Too many email change requests. Please wait a moment." };
  }

  try {
    const { error } = await supabase.auth.updateUser({
      email: parsed.data,
    });

    if (error) {
      logger.warn("Failed to initiate email change", { error: error.message, userId: user.id });
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: `A confirmation link has been sent to ${parsed.data}. Check your inbox to finalize the change.`,
    };
  } catch (err) {
    logger.error("Exception during updateEmailAddress", err, { userId: user.id });
    return { success: false, error: "Unable to update email address." };
  }
}

/**
 * Directly updates the current user's password.
 */
export async function changePasswordAction(newPassword: string): Promise<SettingsActionResult> {
  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid password." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const rl = await rateLimit("password-change", user.id, RATE_LIMIT_PRESETS.AUTH_STRICT);
  if (!rl.success) {
    return { success: false, error: "Too many attempts. Please try again later." };
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: parsed.data,
    });

    if (error) {
      logger.warn("Failed to change password", { error: error.message, userId: user.id });
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: "Your password has been successfully updated.",
    };
  } catch (err) {
    logger.error("Exception during changePassword", err, { userId: user.id });
    return { success: false, error: "Unable to change password." };
  }
}

/**
 * Updates user localization preferences (timezone, first day of the week)
 */
export async function updateUserLocalizationAction(data: {
  timezone?: string;
  firstDayOfWeek?: "monday" | "sunday";
}): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  try {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.timezone) updates.timezone = data.timezone;
    if (data.firstDayOfWeek) updates.first_day_of_week = data.firstDayOfWeek;

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      logger.warn("Could not save localization preferences", { error: error.message, userId: user.id });
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Preferences updated." };
  } catch (err) {
    logger.error("Exception during updateUserLocalization", err, { userId: user.id });
    return { success: false, error: "Unable to save preferences." };
  }
}

/**
 * Updates typography settings in user profile
 */
export async function updateTypographySettingsAction(settings: {
  baseFontSize: string;
  h1Size: string;
  h2Size: string;
  h3Size: string;
}): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        typography_settings: settings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      logger.warn("Could not save typography settings", { error: error.message, userId: user.id });
      return { success: false, error: error.message };
    }

    return { success: true, message: "Typography preferences saved." };
  } catch (err) {
    logger.error("Exception during updateTypographySettings", err, { userId: user.id });
    return { success: false, error: "Unable to save typography." };
  }
}

/**
 * Updates organization branding & email dispatch settings
 * Enforces owner/admin authorization
 */
export async function updateOrganizationBrandingAction(
  orgId: string,
  data: {
    allowUserEmailDispatch: boolean;
    brandingSettings: {
      senderName?: string;
      customLogoUrl?: string;
      footerText?: string;
      brandColor?: string;
    };
  }
): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  // Verify membership and role
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { success: false, error: "Only organization owners and admins can modify branding settings." };
  }

  try {
    const { error } = await supabase
      .from("organizations")
      .update({
        allow_user_email_dispatch: data.allowUserEmailDispatch,
        branding_settings: data.brandingSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);

    if (error) {
      logger.error("Failed to update organization branding", error, { orgId, userId: user.id });
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Branding settings saved." };
  } catch (err) {
    logger.error("Exception during updateOrganizationBranding", err, { orgId, userId: user.id });
    return { success: false, error: "Unable to update branding settings." };
  }
}

/**
 * Retrieves the current user's full profile including extended settings
 */
export async function getUserProfileAction(): Promise<{
  success: boolean;
  profile?: Record<string, unknown>;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, profile: profile || undefined };
  } catch (err) {
    logger.error("Exception in getUserProfileAction", err, { userId: user.id });
    return { success: false, error: "Failed to retrieve profile." };
  }
}

/**
 * Updates user profile details (full name, avatar, phone, date/time format, timezone, first day of week)
 */
export async function updateUserProfileInfoAction(data: {
  fullName?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  dateFormat?: string;
  timeFormat?: string;
  timezone?: string;
  firstDayOfWeek?: "monday" | "sunday";
  language?: string;
}): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  try {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.fullName !== undefined) updates.full_name = data.fullName.trim();
    if (data.avatarUrl !== undefined) updates.avatar_url = data.avatarUrl.trim();
    if (data.phoneNumber !== undefined) updates.phone_number = data.phoneNumber.trim();
    if (data.dateFormat !== undefined) updates.date_format = data.dateFormat;
    if (data.timeFormat !== undefined) updates.time_format = data.timeFormat;
    if (data.timezone !== undefined) updates.timezone = data.timezone;
    if (data.firstDayOfWeek !== undefined) updates.first_day_of_week = data.firstDayOfWeek;

    const { error: profileError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (profileError) {
      logger.warn("Could not update profile fields", { error: profileError.message, userId: user.id });
      return { success: false, error: profileError.message };
    }

    // Also sync full_name & avatar_url with Supabase Auth metadata
    if (data.fullName !== undefined || data.avatarUrl !== undefined) {
      await supabase.auth.updateUser({
        data: {
          ...(data.fullName !== undefined ? { full_name: data.fullName.trim(), name: data.fullName.trim() } : {}),
          ...(data.avatarUrl !== undefined ? { avatar_url: data.avatarUrl.trim() } : {}),
        },
      });
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Profile updated successfully." };
  } catch (err) {
    logger.error("Exception during updateUserProfileInfo", err, { userId: user.id });
    return { success: false, error: "Failed to update profile." };
  }
}

/**
 * Updates personal workspace preferences in profiles.user_preferences jsonb
 */
export async function updateUserPreferencesAction(
  prefs: Record<string, unknown>
): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  try {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_preferences")
      .eq("id", user.id)
      .maybeSingle();

    const existingPrefs = (existingProfile?.user_preferences as Record<string, unknown>) || {};
    const merged = { ...existingPrefs, ...prefs };

    const { error } = await supabase
      .from("profiles")
      .update({
        user_preferences: merged,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: "Preferences updated." };
  } catch (err) {
    logger.error("Exception in updateUserPreferencesAction", err, { userId: user.id });
    return { success: false, error: "Failed to update preferences." };
  }
}

/**
 * Updates workspace general info (name, logo, description, industry, company size, country)
 */
export async function updateWorkspaceGeneralAction(
  orgId: string,
  data: {
    name?: string;
    logoUrl?: string;
    description?: string;
    industry?: string;
    companySize?: string;
    country?: string;
  }
): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  // Verify owner/admin role
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { success: false, error: "Only owners and admins can edit workspace settings." };
  }

  try {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.logoUrl !== undefined) updates.logo_url = data.logoUrl.trim();
    if (data.description !== undefined) updates.description = data.description.trim();
    if (data.industry !== undefined) updates.industry = data.industry.trim();
    if (data.companySize !== undefined) updates.company_size = data.companySize.trim();
    if (data.country !== undefined) updates.country = data.country.trim();

    const { error } = await supabase
      .from("organizations")
      .update(updates)
      .eq("id", orgId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Workspace settings updated." };
  } catch (err) {
    logger.error("Exception in updateWorkspaceGeneralAction", err, { orgId, userId: user.id });
    return { success: false, error: "Failed to update workspace." };
  }
}

/**
 * Updates workspace-wide defaults (task status, priority, meeting duration, etc.)
 */
export async function updateWorkspaceDefaultsAction(
  orgId: string,
  defaults: Record<string, unknown>
): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { success: false, error: "Only owners and admins can configure workspace defaults." };
  }

  try {
    const { data: org } = await supabase
      .from("organizations")
      .select("workspace_defaults")
      .eq("id", orgId)
      .maybeSingle();

    const existing = (org?.workspace_defaults as Record<string, unknown>) || {};
    const merged = { ...existing, ...defaults };

    const { error } = await supabase
      .from("organizations")
      .update({
        workspace_defaults: merged,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Workspace defaults saved." };
  } catch (err) {
    logger.error("Exception in updateWorkspaceDefaultsAction", err, { orgId, userId: user.id });
    return { success: false, error: "Failed to update defaults." };
  }
}

/**
 * Fetches recent audit logs for an organization
 */
export async function getOrganizationAuditLogsAction(
  orgId: string,
  limit = 40
): Promise<{
  success: boolean;
  logs?: Array<{
    id: string;
    actor_name: string | null;
    actor_email: string | null;
    action: string;
    resource_type: string;
    resource_name: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  try {
    const { data: logs, error } = await supabase
      .from("audit_logs")
      .select("id, actor_name, actor_email, action, resource_type, resource_name, metadata, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      // If table has not yet been populated or returns empty, return empty list gracefully
      return { success: true, logs: [] };
    }

    return { success: true, logs: logs || [] };
  } catch (err) {
    logger.error("Exception in getOrganizationAuditLogsAction", err, { orgId, userId: user.id });
    return { success: true, logs: [] };
  }
}

/**
 * Retrieves storage usage information for an organization
 */
export async function getOrganizationStorageStatsAction(orgId: string) {
  const { getOrganizationStorageQuota } = await import("@/lib/files/quotas");
  try {
    const quota = await getOrganizationStorageQuota(orgId);
    return { success: true, quota };
  } catch (err) {
    logger.error("Exception in getOrganizationStorageStatsAction", err, { orgId });
    return {
      success: false,
      quota: {
        usedBytes: 0,
        limitBytes: 5242880000,
        remainingBytes: 5242880000,
        usagePercentage: 0,
        isQuotaExceeded: false,
        plan: "Starter",
      },
    };
  }
}

/**
 * Exports personal user data in JSON format
 */
export async function exportPersonalDataAction(): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    const { data: notificationPrefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id);

    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id, role, created_at")
      .eq("user_id", user.id);

    const exportPayload = {
      exportTimestamp: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
      },
      profile: profile || {},
      notificationPreferences: notificationPrefs || [],
      memberships: memberships || [],
    };

    return { success: true, data: exportPayload };
  } catch (err) {
    logger.error("Exception in exportPersonalDataAction", err, { userId: user.id });
    return { success: false, error: "Unable to generate export." };
  }
}

/**
 * Exports organization workspace metadata in JSON format (Owner/Admin only)
 */
export async function exportWorkspaceDataAction(orgId: string): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { success: false, error: "Only owners and admins can export workspace data." };
  }

  try {
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .maybeSingle();

    const { data: members } = await supabase
      .from("organization_members")
      .select("id, user_id, role, created_at")
      .eq("organization_id", orgId);

    const exportPayload = {
      exportTimestamp: new Date().toISOString(),
      organization: org || {},
      members: members || [],
    };

    return { success: true, data: exportPayload };
  } catch (err) {
    logger.error("Exception in exportWorkspaceDataAction", err, { orgId, userId: user.id });
    return { success: false, error: "Unable to export workspace data." };
  }
}
