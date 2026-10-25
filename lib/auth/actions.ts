"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { rateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { sanitizeRedirectUrl } from "@/lib/security/redirects";
import { checkPasswordRequirements } from "@/lib/auth/password-rules";

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

  // Check if Two-Factor Authentication (AAL2) is required for this account
  try {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData && aalData.currentLevel === "aal1" && aalData.nextLevel === "aal2") {
      redirect(`/auth/mfa?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  } catch (mfaCheckErr) {
    // If it's a Next.js redirect error, re-throw it so the redirect executes
    if (mfaCheckErr && typeof mfaCheckErr === "object" && "digest" in mfaCheckErr) {
      throw mfaCheckErr;
    }
    logger.warn("Could not check MFA assurance level", { error: mfaCheckErr });
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

  const passwordCheck = checkPasswordRequirements(password);
  if (!passwordCheck.allMet) {
    return {
      error: `Password must satisfy all requirements: ${passwordCheck.errors.join(", ")}.`,
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        marketing_consent: marketingConsent,
      },
      emailRedirectTo: `${appUrl}/api/auth/callback?next=${encodeURIComponent(returnUrl)}`,
    },
  });

  if (error) {
    logger.warn(`Sign up rejected: ${error.message}`, { clientIp, code: error.code });
    if (error.message.includes("Error sending confirmation email")) {
      return {
        error:
          "Unable to send confirmation email at this time. Please check that a custom SMTP provider is configured in Supabase or try again shortly.",
      };
    }
    return { error: error.message };
  }

  // If email confirmation is required by Supabase Auth, user has no active session yet
  if (data?.user && !data.session) {
    redirect(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  revalidatePath("/", "layout");
  redirect(returnUrl);
}

/**
 * Resends the signup confirmation email with strict rate limiting.
 */
export async function resendVerificationEmailAction(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const clientIp = await getClientIp();

  const rl = await rateLimit("resend-verify", `${clientIp}:${email.toLowerCase()}`, RATE_LIMIT_PRESETS.AUTH_STRICT);
  if (!rl.success) {
    return { success: false, error: "Please wait a moment before requesting another confirmation email." };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${appUrl}/api/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    logger.warn("Resend confirmation email failed", { email, error: error.message });
    return {
      success: false,
      error: error.message.includes("Error sending confirmation email")
        ? "Email delivery failed. Please verify your custom SMTP configuration in Supabase Dashboard."
        : error.message,
    };
  }

  return { success: true };
}

/**
 * Initiates Supabase OAuth authentication for GitHub or Google with rate limiting.
 */
export async function initiateOAuthAction(
  provider: "github" | "google" = "github",
  rawReturnUrl?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (provider !== "github" && provider !== "google") {
    return { success: false, error: "Only GitHub and Google OAuth are currently supported." };
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
    provider,
    options: {
      redirectTo: `${appUrl}/api/auth/callback?next=${encodeURIComponent(safeNext)}`,
      queryParams:
        provider === "google"
          ? {
              access_type: "offline",
              prompt: "consent",
            }
          : undefined,
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

const otpEmailSchema = z.string().trim().email("Please provide a valid work email address");

/**
 * Sends a one-time login code (OTP) via email using Supabase Auth (Resend SMTP).
 * strictly uses shouldCreateUser: false to disallow creating accounts via the login flow.
 */
export async function sendEmailOtpAction(
  email: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const parsed = otpEmailSchema.safeParse(email);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid email address." };
  }

  const clientIp = await getClientIp();
  const rl = await rateLimit("send-email-otp", `${clientIp}:${parsed.data.toLowerCase()}`, RATE_LIMIT_PRESETS.AUTH_STRICT);
  if (!rl.success) {
    return { success: false, error: "Too many code requests. Please wait a moment before trying again." };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: false, // Strictly prevents creating accounts via login
      emailRedirectTo: `${appUrl}/api/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    logger.warn("Sign in with email OTP failed", { email: parsed.data, error: error.message });
    if (
      error.message.includes("Signups not allowed for otp") ||
      error.message.includes("otp_disabled") ||
      error.message.includes("User not found")
    ) {
      return {
        success: false,
        error: "No account found with this email. Please sign up to start your workspace.",
      };
    }
    if (error.message.includes("Error sending confirmation email") || error.message.includes("email provider")) {
      return {
        success: false,
        error: "Email delivery failed. Please ensure custom SMTP (Resend) is configured in Supabase or try again shortly.",
      };
    }
    return { success: false, error: error.message };
  }

  return {
    success: true,
    message: `A 6-digit login code has been sent to ${parsed.data}.`,
  };
}

/**
 * Verifies a 6-digit email OTP login code and establishes an authenticated session.
 * Enforces AAL2 redirection if the account has active MFA.
 */
export async function verifyEmailOtpAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get("email") as string)?.trim();
  const code = (formData.get("code") as string)?.trim().replace(/\D/g, "");
  const rawReturnUrl = formData.get("returnUrl") as string;
  const returnUrl = sanitizeRedirectUrl(rawReturnUrl, "/dashboard");

  const parsedEmail = otpEmailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return { error: "Please provide a valid email address." };
  }

  if (!code || code.length !== 6) {
    return { error: "Please enter a valid 6-digit authentication code." };
  }

  const clientIp = await getClientIp();
  const rl = await rateLimit("verify-email-otp", `${clientIp}:${parsedEmail.data.toLowerCase()}`, RATE_LIMIT_PRESETS.AUTH_STRICT);
  if (!rl.success) {
    return { error: "Too many verification attempts. Please wait a moment." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    email: parsedEmail.data,
    token: code,
    type: "email",
  });

  if (error) {
    logger.warn("Email OTP verification failure", { email: parsedEmail.data, error: error.message });
    return { error: "Invalid or expired authentication code. Please check your email or request a new code." };
  }

  // Check if Two-Factor Authentication (AAL2) is required for this account
  try {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData && aalData.currentLevel === "aal1" && aalData.nextLevel === "aal2") {
      redirect(`/auth/mfa?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  } catch (mfaCheckErr) {
    if (mfaCheckErr && typeof mfaCheckErr === "object" && "digest" in mfaCheckErr) {
      throw mfaCheckErr;
    }
    logger.warn("Could not check MFA assurance level after email OTP verify", { error: mfaCheckErr });
  }

  revalidatePath("/", "layout");
  redirect(returnUrl);
}

/**
 * Verifies a 2FA MFA code (TOTP or Phone) during the sign-in challenge.
 */
export async function verifyMfaLoginAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const code = (formData.get("code") as string)?.trim();
  const rawReturnUrl = formData.get("returnUrl") as string;
  const returnUrl = sanitizeRedirectUrl(rawReturnUrl, "/dashboard");

  if (!code || code.length !== 6) {
    return { error: "Please enter a valid 6-digit authentication code." };
  }

  const clientIp = await getClientIp();
  const rl = await rateLimit("mfa-verify", clientIp, RATE_LIMIT_PRESETS.AUTH_STRICT);
  if (!rl.success) {
    return { error: "Too many verification attempts. Please wait a moment." };
  }

  const supabase = await createClient();

  // Retrieve factors to locate active verified TOTP or phone factor
  const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError || !factorsData) {
    logger.warn("Failed to list MFA factors during login", { error: factorsError?.message });
    return { error: "Could not retrieve multi-factor authentication details. Please try again." };
  }

  const verifiedFactor = (factorsData.totp || []).find((f) => f.status === "verified");
  if (!verifiedFactor) {
    return { error: "No verified two-factor authentication factor found for this account." };
  }

  // Create challenge
  const challengeRes = await supabase.auth.mfa.challenge({
    factorId: verifiedFactor.id,
  });

  if (challengeRes.error || !challengeRes.data) {
    return { error: challengeRes.error?.message || "Failed to initiate 2FA challenge." };
  }

  // Verify the code
  const verifyRes = await supabase.auth.mfa.verify({
    factorId: verifiedFactor.id,
    challengeId: challengeRes.data.id,
    code,
  });

  if (verifyRes.error) {
    return { error: "Invalid authentication code. Please check your authenticator app and try again." };
  }

  revalidatePath("/", "layout");
  redirect(returnUrl);
}

/**
 * Signs out during an active MFA challenge and returns to login.
 */
export async function signOutMfaAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
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
 * Sends a 6-digit recovery OTP code to the user's email for password reset.
 * Uses Supabase signInWithOtp with shouldCreateUser: false to generate and email a 6-digit OTP code.
 */
export async function sendRecoveryOtpAction(
  email: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const parsed = otpEmailSchema.safeParse(email);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid email address." };
  }

  const clientIp = await getClientIp();
  const rl = await rateLimit("send-recovery-otp", `${clientIp}:${parsed.data.toLowerCase()}`, RATE_LIMIT_PRESETS.AUTH_STRICT);
  if (!rl.success) {
    return { success: false, error: "Too many code requests. Please wait a moment before trying again." };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Use signInWithOtp to instruct Supabase to generate and send a 6-digit OTP code
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: false, // Ensures account exists; prevents unauthorized account creation
      emailRedirectTo: `${appUrl}/api/auth/callback?next=/reset-password`,
    },
  });

  if (error) {
    logger.warn("Send recovery OTP failed", { email: parsed.data, error: error.message });
    if (
      error.message.includes("Signups not allowed for otp") ||
      error.message.includes("otp_disabled") ||
      error.message.includes("User not found")
    ) {
      return {
        success: false,
        error: "No account found with this email. Please check your email address or sign up.",
      };
    }
    if (error.message.includes("Error sending confirmation email") || error.message.includes("email provider")) {
      return {
        success: false,
        error: "Email delivery failed. Please ensure custom SMTP (Resend) is configured in Supabase or try again shortly.",
      };
    }
    return { success: false, error: error.message };
  }

  return {
    success: true,
    message: `A 6-digit recovery code has been sent to ${parsed.data}.`,
  };
}

/**
 * Verifies a 6-digit recovery OTP code and establishes an authenticated recovery session,
 * redirecting the user to /reset-password to set their new password.
 */
export async function verifyRecoveryOtpAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get("email") as string)?.trim();
  const code = (formData.get("code") as string)?.trim().replace(/\D/g, "");

  const parsedEmail = otpEmailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return { error: "Please provide a valid email address." };
  }

  if (!code || code.length !== 6) {
    return { error: "Please enter a valid 6-digit recovery code." };
  }

  const clientIp = await getClientIp();
  const rl = await rateLimit("verify-recovery-otp", `${clientIp}:${parsedEmail.data.toLowerCase()}`, RATE_LIMIT_PRESETS.AUTH_STRICT);
  if (!rl.success) {
    return { error: "Too many recovery attempts. Please wait a moment." };
  }

  const supabase = await createClient();

  // Try verifying with type 'email' (from signInWithOtp), fallback to 'recovery' if configured
  let { error } = await supabase.auth.verifyOtp({
    email: parsedEmail.data,
    token: code,
    type: "email",
  });

  if (error) {
    const fallback = await supabase.auth.verifyOtp({
      email: parsedEmail.data,
      token: code,
      type: "recovery",
    });
    error = fallback.error;
  }

  if (error) {
    logger.warn("Recovery OTP verification failure", { email: parsedEmail.data, error: error.message });
    return { error: "Invalid or expired recovery code. Please check your email or request a new code." };
  }

  revalidatePath("/", "layout");
  redirect("/reset-password");
}

/**
 * Verifies a 6-digit signup confirmation code (OTP) and immediately establishes the session.
 */
export async function verifySignUpOtpAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get("email") as string)?.trim();
  const code = (formData.get("code") as string)?.trim().replace(/\D/g, "");
  const rawReturnUrl = formData.get("returnUrl") as string;
  const returnUrl = sanitizeRedirectUrl(rawReturnUrl, "/onboarding");

  const parsedEmail = otpEmailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return { error: "Please provide a valid work email address." };
  }

  if (!code || code.length !== 6) {
    return { error: "Please enter the 6-digit verification code." };
  }

  const clientIp = await getClientIp();
  const rl = await rateLimit("verify-signup-otp", `${clientIp}:${parsedEmail.data.toLowerCase()}`, RATE_LIMIT_PRESETS.AUTH_STRICT);
  if (!rl.success) {
    return { error: "Too many verification attempts. Please wait a moment." };
  }

  const supabase = await createClient();

  // Try verifying with type 'signup' first, fall back to 'email' if needed
  let { error } = await supabase.auth.verifyOtp({
    email: parsedEmail.data,
    token: code,
    type: "signup",
  });

  if (error) {
    const fallback = await supabase.auth.verifyOtp({
      email: parsedEmail.data,
      token: code,
      type: "email",
    });
    error = fallback.error;
  }

  if (error) {
    logger.warn("Signup OTP verification failure", { email: parsedEmail.data, error: error.message });
    return { error: "Invalid or expired verification code. Please request a new code or click the confirmation link in your email." };
  }

  revalidatePath("/", "layout");
  redirect(returnUrl);
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

  if (!password) {
    return { error: "Password is required." };
  }

  const passwordCheck = checkPasswordRequirements(password);
  if (!passwordCheck.allMet) {
    return {
      error: `Password must satisfy all requirements: ${passwordCheck.errors.join(", ")}.`,
    };
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
