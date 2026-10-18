"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { rateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { sanitizeRedirectUrl } from "@/lib/security/redirects";

const authSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export interface AuthState {
  error?: string;
  success?: boolean;
  message?: string;
}

/**
 * Handles email/password sign-in with rate limiting and secure returnUrl validation.
 */
export async function signInAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const clientIp = await getClientIp();

  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const rawReturnUrl = formData.get("returnUrl");
  const returnUrl =
    typeof rawReturnUrl === "string" && rawReturnUrl.trim().length > 0
      ? sanitizeRedirectUrl(rawReturnUrl, "/dashboard")
      : "/dashboard";

  const parsed = authSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid credentials." };
  }

  const { email, password } = parsed.data;

  // Rate limit by IP + normalized email
  const rl = await rateLimit("sign-in", `${clientIp}:${email.toLowerCase()}`, RATE_LIMIT_PRESETS.AUTH_STRICT);
  if (!rl.success) {
    logger.warn("Rate limit exceeded for sign in attempt", { clientIp });
    return { error: "Too many sign-in attempts. Please try again in a few moments." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    logger.warn("Sign in authentication failure", {
      clientIp,
      code: error.code,
      message: error.message,
    });
    const userMessage =
      error.message === "fetch failed"
        ? "Unable to connect to authentication service. Please check your internet connection or try again."
        : error.message;
    return { error: userMessage };
  }

  revalidatePath("/", "layout");
  redirect(returnUrl);
}

/**
 * Handles new user sign-up with email, password, rate limiting, and required Terms consent.
 * Captures optional marketing consent (NOT pre-checked).
 */
export async function signUpAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const clientIp = await getClientIp();

  const rl = await rateLimit("sign-up", clientIp, RATE_LIMIT_PRESETS.SIGNUP);
  if (!rl.success) {
    logger.warn("Rate limit exceeded for sign up attempt", { clientIp });
    return { error: "Too many account registrations from this network. Please try again later." };
  }

  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const fullName = (formData.get("fullName") as string)?.trim() || "";
  const termsConsent = formData.get("termsConsent") === "on";
  const marketingConsent = formData.get("marketingConsent") === "on";

  if (!termsConsent) {
    return {
      error: "You must agree to the Terms of Service and Privacy Policy to create an account.",
    };
  }

  const rawReturnUrl = formData.get("returnUrl");
  const returnUrl =
    typeof rawReturnUrl === "string" && rawReturnUrl.trim().length > 0
      ? sanitizeRedirectUrl(rawReturnUrl, "/onboarding")
      : "/onboarding";

  const parsed = authSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid sign up details." };
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        marketing_consent: marketingConsent,
      },
    },
  });

  if (error) {
    logger.error("Sign up failure", error, { clientIp });
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(returnUrl);
}

/**
 * Initiates Supabase OAuth authentication for GitHub with rate limiting.
 * Note: Google OAuth is deferred to future phases and not supported here.
 */
export async function initiateOAuthAction(
  provider: "github" = "github",
  rawReturnUrl?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (provider !== "github") {
    return { success: false, error: "Only GitHub OAuth is supported in this phase." };
  }

  const clientIp = await getClientIp();
  const rl = await rateLimit("oauth-init", clientIp, RATE_LIMIT_PRESETS.INTEGRATIONS);
  if (!rl.success) {
    return { success: false, error: "Too many authentication requests. Please try again shortly." };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const safeNext = sanitizeRedirectUrl(rawReturnUrl, "/dashboard");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${appUrl}/api/auth/callback?next=${encodeURIComponent(safeNext)}`,
    },
  });

  if (error) {
    logger.error("Failed to initiate OAuth with Supabase", error);
    return { success: false, error: error.message };
  }

  if (data?.url) {
    return { success: true, url: data.url };
  }

  return { success: false, error: "Failed to obtain authorization URL from provider." };
}

/**
 * Requests a password reset email from Supabase Auth with rate limiting.
 */
export async function requestPasswordResetAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const clientIp = await getClientIp();
  const email = (formData.get("email") as string)?.trim();

  if (!email) {
    return { error: "Please enter your email address." };
  }

  const rl = await rateLimit("password-reset", `${clientIp}:${email.toLowerCase()}`, RATE_LIMIT_PRESETS.AUTH_STRICT);
  if (!rl.success) {
    logger.warn("Rate limit exceeded for password reset request", { clientIp });
    return { error: "Too many reset requests. Please wait a few minutes before trying again." };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/api/auth/callback?next=/reset-password`,
  });

  if (error) {
    logger.error("Password reset request error", error);
    return { error: error.message };
  }

  return {
    success: true,
    message: "If an account exists with that email, a password reset link has been sent.",
  };
}

/**
 * Sets a new password for the currently authenticated user arriving via reset link with rate limiting.
 */
export async function updatePasswordAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Session expired or invalid reset link. Please request a new one." };
  }

  const rl = await rateLimit("password-update", user.id, RATE_LIMIT_PRESETS.AUTH_STRICT);
  if (!rl.success) {
    return { error: "Too many password update attempts. Please wait a moment." };
  }

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    logger.error("Password update error", error, { userId: user.id });
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Handles user sign-out and session revocation.
 */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
