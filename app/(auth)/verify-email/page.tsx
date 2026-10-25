"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, ArrowRight, RefreshCw, Loader2, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  resendVerificationEmailAction,
  verifySignUpOtpAction,
  AuthState,
} from "@/lib/auth/actions";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const rawReturnUrl = searchParams.get("returnUrl") || "/onboarding";

  const [email, setEmail] = React.useState(initialEmail);
  const [code, setCode] = React.useState("");
  const [isResending, setIsResending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [resendStatus, setResendStatus] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [verifyState, verifyFormAction, isVerifying] = React.useActionState<AuthState, FormData>(
    verifySignUpOtpAction,
    {}
  );

  // Cooldown countdown timer
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email.trim() || cooldown > 0 || isResending) return;

    setIsResending(true);
    setResendStatus(null);

    try {
      const result = await resendVerificationEmailAction(email.trim());
      if (result.success) {
        setResendStatus({
          type: "success",
          message: "A new 6-digit confirmation code and link have been sent!",
        });
        setCooldown(60);
      } else {
        setResendStatus({
          type: "error",
          message: result.error || "Failed to resend email. Please try again.",
        });
      }
    } catch {
      setResendStatus({
        type: "error",
        message: "Network error occurred while requesting confirmation email.",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0B0C] px-4 py-12 text-[#F5F5F5]">
      <div className="w-full max-w-sm">
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-md">
            <Mail className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-[#F5F5F5]">
            Verify your email
          </h2>
          <p className="mt-1 text-xs text-[#A1A1AA] leading-relaxed max-w-xs">
            We sent a 6-digit verification code to confirm your account
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-xl border border-[#29292D] bg-[#141416] p-6 shadow-xl space-y-4">
          {/* Email badge / editable if empty */}
          {email ? (
            <div className="flex items-center justify-between rounded-lg border border-[#29292D] bg-[#19191C] px-3 py-2 text-xs">
              <span className="text-[#A1A1AA] truncate">{email}</span>
              <button
                type="button"
                onClick={() => {
                  const newEmail = prompt("Enter your email address:", email);
                  if (newEmail && newEmail.trim()) setEmail(newEmail.trim());
                }}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium shrink-0 ml-2"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#A1A1AA]">
                Work Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@company.com"
                required
                className="w-full rounded-lg border border-[#29292D] bg-[#19191C] px-3 py-2 text-xs text-[#F5F5F5] placeholder:text-[#52525B] focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {/* Verification Code Form */}
          <form action={verifyFormAction} className="space-y-4">
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="returnUrl" value={rawReturnUrl} />

            {verifyState?.error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                {verifyState.error}
              </div>
            )}

            {resendStatus && (
              <div
                className={`rounded-lg border p-2.5 text-xs text-center ${
                  resendStatus.type === "success"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/20 bg-red-500/10 text-red-400"
                }`}
              >
                {resendStatus.message}
              </div>
            )}

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
                  disabled={cooldown > 0 || isResending || !email.trim()}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 disabled:text-[#52525B] transition-colors"
                >
                  <RefreshCw className={`h-3 w-3 ${isResending ? "animate-spin" : ""}`} />
                  <span>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</span>
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isVerifying || code.length !== 6 || !email.trim()}
              className="w-full gap-2 mt-2"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying code...</span>
                </>
              ) : (
                <>
                  <span>Verify & Continue</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Option to Verify Later */}
          <div className="rounded-lg border border-[#29292D] bg-[#19191C]/60 p-3 text-center space-y-2">
            <p className="text-[11px] text-[#71717A]">
              Want to set up your workspace now and verify later?
            </p>
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-md text-xs font-medium text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A] border border-[#29292D] transition-all"
            >
              <Clock className="h-3.5 w-3.5 text-blue-400" />
              <span>Verify email later</span>
            </Link>
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between border-t border-[#29292D] pt-4 text-xs">
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 text-[#71717A] hover:text-[#F5F5F5] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Different email</span>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span>Back to Sign In</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={null}>
      <VerifyEmailContent />
    </React.Suspense>
  );
}
