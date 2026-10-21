"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import {
  signInAction,
  sendEmailOtpAction,
  verifyEmailOtpAction,
  AuthState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OAuthButtons } from "@/components/ui/oauth-buttons";
import clsx from "clsx";

function AuthQueryError() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  if (!errorParam) return null;

  let message = "An authentication error occurred. Please try again.";
  if (errorParam === "auth-code-error") {
    message = "Authentication was canceled or the authorization code was invalid.";
  } else if (errorParam === "too-many-requests") {
    message = "Too many authentication attempts. Please try again in a few minutes.";
  } else if (errorParam === "oauth_cancelled") {
    message = "Social sign-in was canceled. You can try again when ready.";
  } else if (errorParam === "rate_limit_exceeded") {
    message = "Rate limit exceeded. Please wait a moment before trying again.";
  }

  return (
    <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
      {message}
    </div>
  );
}

function EmailOtpForm({ returnUrl }: { returnUrl: string }) {
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [step, setStep] = React.useState<"email" | "code">("email");
  const [isSending, setIsSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  const [verifyState, verifyFormAction, isVerifying] = React.useActionState<AuthState, FormData>(
    verifyEmailOtpAction,
    {}
  );

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isSending || cooldown > 0) return;

    setIsSending(true);
    setSendError(null);
    setSendSuccess(null);

    try {
      const res = await sendEmailOtpAction(email.trim());
      if (res.success) {
        setSendSuccess(res.message || "A 6-digit login code has been sent.");
        setStep("code");
        setCooldown(60);
      } else {
        setSendError(res.error || "Failed to send login code.");
      }
    } catch (err: any) {
      setSendError(err?.message || "An unexpected error occurred while sending the code.");
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isSending) return;
    setIsSending(true);
    setSendError(null);
    try {
      const res = await sendEmailOtpAction(email.trim());
      if (res.success) {
        setSendSuccess("New verification code sent!");
        setCooldown(60);
      } else {
        setSendError(res.error || "Failed to resend code.");
      }
    } finally {
      setIsSending(false);
    }
  };

  if (step === "email") {
    return (
      <form onSubmit={handleSendCode} className="space-y-4">
        {sendError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            {sendError}
          </div>
        )}

        <Input
          label="Work Email"
          name="email"
          type="email"
          placeholder="alex@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
        />

        <p className="text-[11px] text-[#71717A]">
          We&apos;ll email you a 6-digit login code. Passwordless, secure authentication.
        </p>

        <Button
          type="submit"
          disabled={isSending || !email.trim() || cooldown > 0}
          className="w-full gap-2 mt-2"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Sending code...</span>
            </>
          ) : (
            <>
              <span>Send login code</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    );
  }

  return (
    <form action={verifyFormAction} className="space-y-4">
      {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
      <input type="hidden" name="email" value={email} />

      {(verifyState?.error || sendError) && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
          {verifyState?.error || sendError}
        </div>
      )}

      {sendSuccess && !verifyState?.error && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-400 text-center">
          {sendSuccess}
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-[#29292D] bg-[#19191C] px-3 py-2 text-xs">
        <span className="text-[#A1A1AA] truncate">{email}</span>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setCode("");
            setSendError(null);
            setSendSuccess(null);
          }}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium shrink-0 ml-2"
        >
          Change
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-[#A1A1AA] text-center">
          6-digit verification code
        </label>
        <input
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoFocus
          required
          className="w-full text-center tracking-[0.5em] font-mono text-xl py-3 rounded-lg border border-[#29292D] bg-[#19191C] text-[#F5F5F5] placeholder:text-[#52525B] focus:border-blue-500 focus:outline-none transition-colors"
        />
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-[#71717A]">Didn&apos;t receive it?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || isSending}
            className="text-[11px] text-blue-400 hover:text-blue-300 disabled:text-[#52525B] transition-colors"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={isVerifying || code.length !== 6}
        className="w-full gap-2 mt-2"
      >
        {isVerifying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Verifying code...</span>
          </>
        ) : (
          <>
            <span>Verify & Sign In</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

function LoginForm({ returnUrl }: { returnUrl: string }) {
  const [state, formAction, isPending] = React.useActionState<AuthState, FormData>(
    signInAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-4">
      {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}

      {state?.error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
          {state.error}
        </div>
      )}

      <Input
        label="Work Email"
        name="email"
        type="email"
        placeholder="alex@company.com"
        required
        autoComplete="email"
      />

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-[#A1A1AA]">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          name="password"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full gap-2 mt-2"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Signing in...</span>
          </>
        ) : (
          <>
            <span>Sign In</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const rawReturnUrl = searchParams.get("returnUrl") || "";
  const [authMethod, setAuthMethod] = React.useState<"password" | "otp">("password");

  const signUpHref = rawReturnUrl
    ? `/signup?returnUrl=${encodeURIComponent(rawReturnUrl)}`
    : "/signup";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0B0C] px-4 py-12 text-[#F5F5F5]">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#19191C] border border-[#29292D] text-[#F5F5F5] shadow-sm">
            <Sparkles className="h-5 w-5 text-blue-400" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-[#F5F5F5]">
            Welcome back to Company Brain
          </h2>
          <p className="mt-1 text-xs text-[#A1A1AA]">
            Sign in to access your company workspace and memory layer
          </p>
        </div>

        {/* Auth Card */}
        <div className="mt-8 rounded-xl border border-[#29292D] bg-[#141416] p-6 shadow-xl">
          <AuthQueryError />

          {/* OAuth Providers */}
          <OAuthButtons returnUrl={rawReturnUrl} />

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#29292D]" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
              <span className="bg-[#141416] px-2 text-[#71717A] font-medium">
                Or with email
              </span>
            </div>
          </div>

          {/* Auth Method Switcher (Password vs Email OTP) */}
          <div className="flex rounded-lg bg-[#19191C] p-1 border border-[#29292D] mb-4">
            <button
              type="button"
              onClick={() => setAuthMethod("password")}
              className={clsx(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center",
                authMethod === "password"
                  ? "bg-[#27272A] text-white shadow-sm"
                  : "text-[#71717A] hover:text-[#A1A1AA]"
              )}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod("otp")}
              className={clsx(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center",
                authMethod === "otp"
                  ? "bg-[#27272A] text-white shadow-sm"
                  : "text-[#71717A] hover:text-[#A1A1AA]"
              )}
            >
              Email Code (OTP)
            </button>
          </div>

          {authMethod === "password" ? (
            <LoginForm returnUrl={rawReturnUrl} />
          ) : (
            <EmailOtpForm returnUrl={rawReturnUrl} />
          )}

          <div className="mt-6 border-t border-[#29292D] pt-4 text-center text-xs text-[#A1A1AA]">
            Don&apos;t have an account?{" "}
            <Link
              href={signUpHref}
              className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              Start 7-day free trial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginContent />
    </React.Suspense>
  );
}
