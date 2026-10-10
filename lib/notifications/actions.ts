"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  NotificationChannel,
  NotificationCategory,
  UserNotificationPreferences,
  getDefaultPreferences,
  NOTIFICATION_DEFINITIONS,
} from "./types";
import { logger } from "@/lib/security/logger";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

export interface NotificationActionResult {
  success: boolean;
  preferences?: UserNotificationPreferences;
  error?: string;
}

/**
 * Fetches user notification preferences from Supabase, applying default fallbacks
 */
export async function getNotificationPreferencesAction(): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  try {
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("notification_type, in_app_enabled, email_enabled")
      .eq("user_id", user.id);

    if (error) {
      logger.warn("Could not query notification_preferences table, falling back to defaults", {
        userId: user.id,
        error: error.message,
      });
      return { success: true, preferences: getDefaultPreferences() };
    }

    const merged = getDefaultPreferences();
    if (data && data.length > 0) {
      for (const row of data) {
        if (merged[row.notification_type]) {
          merged[row.notification_type] = {
            in_app: Boolean(row.in_app_enabled),
            email: Boolean(row.email_enabled),
          };
        }
      }
    }

    return { success: true, preferences: merged };
  } catch (err) {
    logger.error("Error loading notification preferences", err, { userId: user.id });
    return { success: true, preferences: getDefaultPreferences() };
  }
}

/**
 * Updates a single notification item's channel state
 */
export async function updateNotificationPreferenceAction(
  notificationType: string,
  channel: NotificationChannel,
  enabled: boolean
): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  // Rate limit mutations per user
  const rl = await rateLimit("notif-pref-update", user.id, RATE_LIMIT_PRESETS.MUTATIONS);
  if (!rl.success) {
    return { success: false, error: "Too many updates. Please wait a moment." };
  }

  const def = NOTIFICATION_DEFINITIONS.find((d) => d.id === notificationType);
  if (!def) {
    return { success: false, error: "Invalid notification type" };
  }

  // Check if locked
  if (channel === "in_app" && def.lockedInApp && !enabled) {
    return { success: false, error: "This critical in-app notification cannot be disabled." };
  }
  if (channel === "email" && def.lockedEmail && !enabled) {
    return { success: false, error: "This critical email alert cannot be disabled." };
  }

  try {
    // Check existing record
    const { data: existing } = await supabase
      .from("notification_preferences")
      .select("id, in_app_enabled, email_enabled")
      .eq("user_id", user.id)
      .eq("notification_type", notificationType)
      .maybeSingle();

    const currentInApp = existing?.in_app_enabled ?? def.defaultInApp;
    const currentEmail = existing?.email_enabled ?? def.defaultEmail;

    const updatedInApp = channel === "in_app" ? enabled : currentInApp;
    const updatedEmail = channel === "email" ? enabled : currentEmail;

    const { error: upsertError } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: user.id,
          notification_type: notificationType,
          in_app_enabled: updatedInApp,
          email_enabled: updatedEmail,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id, notification_type" }
      );

    if (upsertError) {
      logger.error("Failed to upsert notification preference", upsertError, {
        userId: user.id,
        notificationType,
      });
      return { success: false, error: upsertError.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    logger.error("Unexpected error updating notification preference", err, { userId: user.id });
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Bulk updates an entire category for a specific channel
 */
export async function bulkUpdateCategoryPreferencesAction(
  category: NotificationCategory,
  channel: NotificationChannel,
  enabled: boolean
): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  const categoryItems = NOTIFICATION_DEFINITIONS.filter((d) => d.category === category);
  if (categoryItems.length === 0) {
    return { success: false, error: "Category not found" };
  }

  try {
    const { data: existingRows } = await supabase
      .from("notification_preferences")
      .select("notification_type, in_app_enabled, email_enabled")
      .eq("user_id", user.id);

    const existingMap = new Map(existingRows?.map((r) => [r.notification_type, r]) || []);

    const upserts = categoryItems.map((item) => {
      const existing = existingMap.get(item.id);
      const currentInApp = existing?.in_app_enabled ?? item.defaultInApp;
      const currentEmail = existing?.email_enabled ?? item.defaultEmail;

      const targetInApp =
        channel === "in_app" ? (item.lockedInApp ? true : enabled) : currentInApp;
      const targetEmail =
        channel === "email" ? (item.lockedEmail ? true : enabled) : currentEmail;

      return {
        user_id: user.id,
        notification_type: item.id,
        in_app_enabled: targetInApp,
        email_enabled: targetEmail,
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase
      .from("notification_preferences")
      .upsert(upserts, { onConflict: "user_id, notification_type" });

    if (error) {
      logger.error("Failed to bulk update category preferences", error, { userId: user.id });
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    logger.error("Bulk update category exception", err, { userId: user.id });
    return { success: false, error: "Failed to update category" };
  }
}
