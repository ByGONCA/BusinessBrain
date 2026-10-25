"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, ArrowLeft, Mail, Loader2, ArrowRight } from "lucide-react";
import {
  requestPasswordResetAction,
  sendRecoveryOtpAction,
  verifyRecoveryOtpAction,
  AuthState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import clsx from "clsx";

function ResetLinkForm() {
  const [state, formAction, isPending] = React.useActionState<AuthState, FormData>(
    requestPasswordResetAction,
    {}
  );

  if (state?.success) {
    return (
      <div className="text-center space-y-4 py-2">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <Mail className="h-5 w-5" />
        </div>
        <p className="text-xs text-[#A1A1AA] leading-relaxed">
          {state.message}
        </p>
        <p className="text-[11px] text-[#71717A]">
          Check your inbox (and spam folder) for the password reset link.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
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
        autoFocus
      />

      <p className="text-[11px] text-[#71717A]">
        We&apos;ll email you a secure link to reset your account password.
      </p>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full gap-2 mt-2"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Sending reset link...</span>
          </>
        ) : (
          <>
            <Mail className="h-4 w-4" />
            <span>Send Reset Link</span>
          </>
        )}
      </Button>
    </form>
  );
}

function ResetOtpForm() {
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [step, setStep] = React.useState<"email" | "code">("email");
  const [isSending, setIsSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  const [verifyState, verifyFormAction, isVerifying] = React.useActionState<AuthState, FormData>(
    verifyRecoveryOtpAction,
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
      const res = await sendRecoveryOtpAction(email.trim());
      if (res.success) {
        setSendSuccess(res.message || "A 6-digit recovery code has been sent.");
        setStep("code");
        setCooldown(60);
      } else {
        setSendError(res.error || "Failed to send recovery code.");
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
      const res = await sendRecoveryOtpAction(email.trim());
      if (res.success) {
        setSendSuccess("New recovery code sent!");
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
          We&apos;ll email you a 6-digit recovery code to reset your password immediately.
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
              <span>Send recovery code</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    );
  }

  return (
    <form action={verifyFormAction} className="space-y-4">
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
          6-digit recovery code
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
            <span>Verify & Reset Password</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

export default function ForgotPasswordPage() {
  const [resetMethod, setResetMethod] = React.useState<"link" | "otp">("link");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0B0C] px-4 py-12 text-[#F5F5F5]">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#19191C] border border-[#29292D] text-[#F5F5F5] shadow-sm">
            <Sparkles className="h-5 w-5 text-blue-400" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-[#F5F5F5]">
            Reset your password
          </h2>
          <p className="mt-1 text-xs text-[#A1A1AA]">
            Choose how you would like to recover your account
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-xl border border-[#29292D] bg-[#141416] p-6 shadow-xl">
          {/* Method Switcher */}
          <div className="flex rounded-lg bg-[#19191C] p-1 border border-[#29292D] mb-5">
            <button
              type="button"
              onClick={() => setResetMethod("link")}
              className={clsx(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center",
                resetMethod === "link"
                  ? "bg-[#27272A] text-white shadow-sm"
                  : "text-[#71717A] hover:text-[#A1A1AA]"
              )}
            >
              Reset Link
            </button>
            <button
              type="button"
              onClick={() => setResetMethod("otp")}
              className={clsx(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center",
                resetMethod === "otp"
                  ? "bg-[#27272A] text-white shadow-sm"
                  : "text-[#71717A] hover:text-[#A1A1AA]"
              )}
            >
              Email Code (OTP)
            </button>
          </div>

          {resetMethod === "link" ? <ResetLinkForm /> : <ResetOtpForm />}

          <div className="pt-5 border-t border-[#29292D] mt-5 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-[#71717A] hover:text-[#F5F5F5] transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
