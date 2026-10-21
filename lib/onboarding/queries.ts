import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface UserOnboardingState {
  onboardingCompleted: boolean;
  tourCompleted: boolean;
  tourStep: number;
  checklistState: {
    page_created?: boolean;
    member_invited?: boolean;
    connection_explored?: boolean;
    settings_configured?: boolean;
    dismissed?: boolean;
    [key: string]: boolean | undefined;
  };
}

/**
 * Retrieves the current user's onboarding and tour state.
 * Memoized per request using React cache().
 */
export const getUserOnboardingState = cache(async (): Promise<UserOnboardingState> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      onboardingCompleted: false,
      tourCompleted: true, // Don't show tour to unauthenticated
      tourStep: 0,
      checklistState: {},
    };
  }

  // Check profiles table first
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, tour_completed, tour_step, checklist_state")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    const rawChecklist = (profile.checklist_state as Record<string, boolean>) || {};
    return {
      onboardingCompleted: profile.onboarding_completed ?? (user.user_metadata?.onboarding_completed ?? false),
      tourCompleted: profile.tour_completed ?? (user.user_metadata?.tour_completed ?? false),
      tourStep: profile.tour_step ?? (user.user_metadata?.tour_step ?? 0),
      checklistState: rawChecklist,
    };
  }

  // Fallback to user_metadata if profile row or columns are pending
  const meta = user.user_metadata || {};
  return {
    onboardingCompleted: !!meta.onboarding_completed,
    tourCompleted: !!meta.tour_completed,
    tourStep: Number(meta.tour_step) || 0,
    checklistState: (meta.checklist_state as Record<string, boolean>) || {},
  };
});
