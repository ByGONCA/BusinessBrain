"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/security/logger";
import { isValidUuid } from "@/lib/security/authorization";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { hasPermission } from "@/lib/permissions/resolver";
import { isCountrySanctioned } from "@/lib/compliance/markets.config";
import { getStripeClient } from "@/lib/stripe/client";

const emailSchema = z.string().trim().email("Please provide a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export interface SettingsActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Ensures user has satisfied 2FA (AAL2) requirements before performing sensitive account actions.
 */
async function assertAal2IfEnrolled(supabase: Awaited<ReturnType<typeof createClient>>): Promise<{ error?: string }> {
  try {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData && aalData.currentLevel === "aal1" && aalData.nextLevel === "aal2") {
      return {
        error: "Two-factor authentication (AAL2) required. Please complete your MFA challenge before performing sensitive account actions.",
      };
    }
  } catch {
    // Graceful ignore if MFA is not enabled
  }
  return {};
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

  const aalCheck = await assertAal2IfEnrolled(supabase);
  if (aalCheck.error) {
    return { success: false, error: aalCheck.error };
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

  const aalCheck = await assertAal2IfEnrolled(supabase);
  if (aalCheck.error) {
    return { success: false, error: aalCheck.error };
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

  // Verify permission: requires company.edit_settings or Owner
  const canEdit = await hasPermission(user.id, orgId, "company.edit_settings");
  if (!canEdit) {
    return { success: false, error: "Forbidden: You do not have permission to modify branding settings." };
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
    const updates: Record<string, unknown> = {};

    if (data.fullName !== undefined) {
      updates.full_name = data.fullName.trim().slice(0, 100);
    }
    if (data.avatarUrl !== undefined) {
      const trimmed = data.avatarUrl.trim();
      if (trimmed.length > 500000) {
        return { success: false, error: "Image payload exceeds maximum allowed size (500KB)." };
      }
      updates.avatar_url = trimmed;
    }
    if (data.phoneNumber !== undefined) {
      updates.phone_number = data.phoneNumber.trim().slice(0, 30);
    }
    if (data.dateFormat !== undefined) {
      updates.date_format = data.dateFormat;
    }
    if (data.timeFormat !== undefined) {
      updates.time_format = data.timeFormat;
    }
    if (data.timezone !== undefined) {
      updates.timezone = data.timezone;
    }
    if (data.firstDayOfWeek !== undefined) {
      updates.first_day_of_week = data.firstDayOfWeek;
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: profileError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (profileError) {
        logger.warn("Could not update profile fields", { error: profileError.message, userId: user.id });
        return { success: false, error: profileError.message };
      }
    }

    // Also sync full_name & avatar_url with Supabase Auth metadata
    if (data.fullName !== undefined || data.avatarUrl !== undefined) {
      const authUpdates: Record<string, string> = {};
      if (data.fullName !== undefined) {
        const cleaned = data.fullName.trim().slice(0, 100);
        authUpdates.full_name = cleaned;
        authUpdates.name = cleaned;
      }
      if (data.avatarUrl !== undefined) {
        authUpdates.avatar_url = data.avatarUrl.trim();
      }

      await supabase.auth.updateUser({
        data: authUpdates,
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

  // Verify permission: requires company.edit_settings or Owner
  const canEditGeneral = await hasPermission(user.id, orgId, "company.edit_settings");
  if (!canEditGeneral) {
    return { success: false, error: "Forbidden: You do not have permission to edit workspace settings." };
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
    if (data.country !== undefined) {
      const trimmedCountry = data.country.trim().toUpperCase();
      if (trimmedCountry) {
        const sanction = isCountrySanctioned(trimmedCountry);
        if (sanction.sanctioned) {
          return {
            success: false,
            error: `Jurisdiction restricted: Workspaces cannot be established in '${trimmedCountry}' due to international trade sanctions (${sanction.reason}).`,
          };
        }
      }
      updates.country = trimmedCountry;
    }

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

  // Verify permission: requires company.edit_settings or Owner
  const canEditDefaults = await hasPermission(user.id, orgId, "company.edit_settings");
  if (!canEditDefaults) {
    return { success: false, error: "Forbidden: You do not have permission to configure workspace defaults." };
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
  if (!orgId || !isValidUuid(orgId)) {
    return { success: false, error: "Invalid organization ID format." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  // Verify caller membership and administrative role (Owner / Admin)
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member || !["owner", "admin"].includes(member.role)) {
    return { success: false, error: "Forbidden: Only owners and admins can view audit logs." };
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
  if (!orgId || !isValidUuid(orgId)) {
    return {
      success: false,
      error: "Invalid organization ID format.",
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
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

  // Verify caller membership in the target organization
  const { data: member } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return {
      success: false,
      error: "Unauthorized: not a member of this workspace.",
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

  // Verify permission: requires company.view_settings or Owner
  const canExport = await hasPermission(user.id, orgId, "company.view_settings");
  if (!canExport) {
    return { success: false, error: "Forbidden: You do not have permission to export workspace data." };
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

/**
 * Initiates phone number verification by sending an SMS OTP via Supabase Auth
 */
export async function initiatePhoneVerificationAction(phoneNumber: string): Promise<SettingsActionResult> {
  const cleanedPhone = phoneNumber.trim().replace(/\s+/g, "");
  // Simple E.164 phone validation: + followed by 7 to 15 digits
  if (!/^\+[1-9]\d{6,14}$/.test(cleanedPhone)) {
    return {
      success: false,
      error: "Please enter a valid international phone number starting with + and country code (e.g. +351912345678).",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const aalCheck = await assertAal2IfEnrolled(supabase);
  if (aalCheck.error) {
    return { success: false, error: aalCheck.error };
  }

  const rl = await rateLimit("phone-verify", user.id, RATE_LIMIT_PRESETS.AUTH_STRICT);
  if (!rl.success) {
    return { success: false, error: "Too many SMS requests. Please wait a few moments before trying again." };
  }

  try {
    const { error } = await supabase.auth.updateUser({
      phone: cleanedPhone,
    });

    if (error) {
      logger.warn("Failed to initiate phone verification SMS", { error: error.message, userId: user.id });
      if (error.message.includes("phone_provider_disabled") || error.message.includes("Unsupported phone provider")) {
        return {
          success: false,
          error: "SMS delivery is currently disabled in the staging authentication provider. Please use Google Authenticator (TOTP) for MFA.",
        };
      }
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: `Verification code sent via SMS to ${cleanedPhone}.`,
    };
  } catch (err) {
    logger.error("Exception in initiatePhoneVerificationAction", err, { userId: user.id });
    return { success: false, error: "Unable to send verification SMS." };
  }
}

/**
 * Verifies the SMS OTP code and saves the phone number to the profile
 */
export async function verifyPhoneCodeAction(phoneNumber: string, code: string): Promise<SettingsActionResult> {
  const cleanedPhone = phoneNumber.trim().replace(/\s+/g, "");
  const cleanedCode = code.trim();

  if (!cleanedCode || cleanedCode.length < 6) {
    return { success: false, error: "Please enter a valid 6-digit verification code." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  try {
    const { error: otpError } = await supabase.auth.verifyOtp({
      phone: cleanedPhone,
      token: cleanedCode,
      type: "phone_change",
    });

    if (otpError) {
      logger.warn("Invalid phone verification OTP", { error: otpError.message, userId: user.id });
      return { success: false, error: otpError.message || "Invalid or expired SMS verification code." };
    }

    // Save phone number to user profile
    await supabase
      .from("profiles")
      .update({
        phone_number: cleanedPhone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    revalidatePath("/dashboard");
    return {
      success: true,
      message: "Phone number successfully verified and attached to your account!",
    };
  } catch (err) {
    logger.error("Exception in verifyPhoneCodeAction", err, { userId: user.id });
    return { success: false, error: "Failed to verify phone code." };
  }
}

/**
 * Removes a verified phone number from the user account
 */
export async function removePhoneNumberAction(): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const aalCheck = await assertAal2IfEnrolled(supabase);
  if (aalCheck.error) {
    return { success: false, error: aalCheck.error };
  }

  try {
    // Clear phone in profile
    await supabase
      .from("profiles")
      .update({
        phone_number: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    revalidatePath("/dashboard");
    return { success: true, message: "Phone number removed from account." };
  } catch (err) {
    logger.error("Exception in removePhoneNumberAction", err, { userId: user.id });
    return { success: false, error: "Failed to remove phone number." };
  }
}


/**
 * Request Account Erasure & Personal Data Deletion (GDPR Article 17 / CCPA)
 *
 * Implements strict security and statutory safeguards:
 * 1. Authentication and rate-limiting enforcement.
 * 2. Strict confirmation token verification ("DELETE").
 * 3. Two-factor authentication (AAL2) challenge check if user is enrolled.
 * 4. Multi-tenant organizational dependency check:
 *    - Blocks deletion if the user is the sole owner of an organization with other active members.
 *    - Requires ownership transfer to prevent orphaned tenant workspaces.
 * 5. Expunges personal identity records (profile, preferences, notification channels).
 * 6. Preserves immutable statutory accounting/tax audit records under legitimate interest / legal obligation
 *    (CIVA / Art. 123.º CIRC in PT/EU; 7-year IRS tax audit rules in the US).
 * 7. Terminates active user sessions cleanly.
 */
export async function requestAccountDeletionAction(confirmationText: string): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.id) {
    return { success: false, error: "Authentication required to perform account deletion." };
  }

  // 1. Rate-limit mutation to prevent brute force or repeated spam
  const rateLimitResult = await rateLimit("account-delete", user.id, RATE_LIMIT_PRESETS.AUTH_STRICT);
  if (!rateLimitResult.success) {
    return { success: false, error: "Too many requests. Please wait before retrying." };
  }

  // 2. Strict Confirmation Token Check
  if (confirmationText.trim() !== "DELETE") {
    return {
      success: false,
      error: "Explicit confirmation required: Please type 'DELETE' to confirm permanent account erasure.",
    };
  }

  // 3. MFA/AAL2 Challenge verification if user is enrolled
  const aalCheck = await assertAal2IfEnrolled(supabase);
  if (aalCheck.error) {
    return { success: false, error: aalCheck.error };
  }

  try {
    // 4. Organizational Dependency & Orphan Protection Check
    const { data: memberships, error: memError } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id);

    if (memError) {
      logger.error("Failed to fetch user memberships for account deletion", memError, { userId: user.id });
      return { success: false, error: "Failed to verify workspace dependencies." };
    }

    if (memberships && memberships.length > 0) {
      for (const m of memberships) {
        if (m.role === "owner") {
          // Check if there are other members in this organization
          const { count, error: countError } = await supabase
            .from("organization_members")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", m.organization_id)
            .neq("user_id", user.id);

          if (!countError && count && count > 0) {
            return {
              success: false,
              error:
                "Account deletion blocked: You are the sole Owner of an active workspace with other team members. To protect shared corporate data, please transfer ownership or remove all other members before deleting your account.",
            };
          }

          // If sole owner of an empty organization, cancel active Stripe subscription to prevent future renewals
          try {
            const { data: sub } = await supabase
              .from("subscriptions")
              .select("status, stripe_subscription_id")
              .eq("organization_id", m.organization_id)
              .maybeSingle();

            if (sub && (sub.status === "active" || sub.status === "trialing") && sub.stripe_subscription_id) {
              let stripeCanceled = false;
              try {
                const stripe = getStripeClient();
                const cancelRes = await stripe.subscriptions.cancel(sub.stripe_subscription_id);
                if (cancelRes.status === "canceled") {
                  stripeCanceled = true;
                }
              } catch (stripeErr: unknown) {
                const errObj = stripeErr as { code?: string; message?: string };
                if (
                  errObj?.code === "resource_missing" ||
                  errObj?.message?.toLowerCase().includes("already canceled") ||
                  errObj?.message?.toLowerCase().includes("no such subscription")
                ) {
                  stripeCanceled = true;
                } else {
                  logger.error("Failed to cancel active Stripe subscription during account erasure", stripeErr, {
                    orgId: m.organization_id,
                    subscriptionId: sub.stripe_subscription_id,
                  });
                  return {
                    success: false,
                    error:
                      "Account deletion halted: Failed to cancel your active Stripe subscription. To avoid unexpected charges, please cancel your subscription in Workspace Billing Settings first, or contact support.",
                  };
                }
              }

              if (stripeCanceled) {
                await supabase
                  .from("subscriptions")
                  .update({ status: "canceled", updated_at: new Date().toISOString() })
                  .eq("organization_id", m.organization_id);
              }
            }
          } catch (subErr) {
            logger.warn("Subscription cleanup check failed during account erasure", {
              orgId: m.organization_id,
              error: subErr instanceof Error ? subErr.message : String(subErr),
            });
          }
        }
      }
    }

    // 5. Expunge Personal Profile Data (Right to Erasure / Article 17 GDPR)
    await supabase
      .from("profiles")
      .update({
        full_name: "Deleted User",
        avatar_url: null,
        phone_number: null,
        marketing_consent: false,
        marketing_consent_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // Sync Auth metadata to expunge personal name & avatar from auth.users
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: "Deleted User",
          name: "Deleted User",
          avatar_url: null,
          picture: null,
        },
      });
    } catch {
      // Non-fatal if auth metadata sync fails
    }

    // 6. Delete personal notification preferences
    await supabase.from("notification_preferences").delete().eq("user_id", user.id);

    // 7. Remove personal organization memberships
    await supabase.from("organization_members").delete().eq("user_id", user.id);

    // 8. Sign out user session
    await supabase.auth.signOut();

    logger.info("User account erasure successfully executed under GDPR Art. 17", {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    revalidatePath("/");
    return {
      success: true,
      message:
        "Your account and personal profile data have been expunged in accordance with GDPR Article 17. Statutory accounting and audit logs are retained under legal obligation.",
    };
  } catch (err) {
    logger.error("Exception in requestAccountDeletionAction", err, { userId: user.id });
    return { success: false, error: "An unexpected error occurred while processing account deletion." };
  }
}
