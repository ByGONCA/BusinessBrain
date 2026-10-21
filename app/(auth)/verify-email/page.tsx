"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, ArrowRight, RefreshCw, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resendVerificationEmailAction } from "@/lib/auth/actions";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [isResending, setIsResending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [resendStatus, setResendStatus] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Cooldown countdown timer
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || cooldown > 0 || isResending) return;

    setIsResending(true);
    setResendStatus(null);

    try {
      const result = await resendVerificationEmailAction(email);
      if (result.success) {
        setResendStatus({
          type: "success",
          message: "Confirmation link resent! Please check your inbox.",
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
      <div className="w-full max-w-md">
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-lg">
            <Mail className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-[#F5F5F5]">
            Check your email
          </h2>
          <p className="mt-2 text-xs text-[#A1A1AA] leading-relaxed max-w-xs">
            We sent a verification link to your email address to confirm your account.
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-xl border border-[#29292D] bg-[#141416] p-6 shadow-xl space-y-5">
          {/* Email badge */}
          {email ? (
            <div className="flex items-center justify-center rounded-lg border border-[#29292D] bg-[#19191C] px-3.5 py-2.5 text-center text-xs">
              <span className="text-[#A1A1AA] mr-1.5">Sent to:</span>
              <span className="font-semibold text-[#F5F5F5] truncate max-w-[240px]">
                {email}
              </span>
            </div>
          ) : (
            <div className="rounded-lg border border-[#29292D] bg-[#19191C] p-3 text-center text-xs text-[#A1A1AA]">
              A confirmation link was sent to the email specified during registration.
            </div>
          )}

          {/* Status Message */}
          {resendStatus && (
            <div
              className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
                resendStatus.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}
            >
              {resendStatus.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span className="leading-snug">{resendStatus.message}</span>
            </div>
          )}

          {/* Instructions */}
          <div className="space-y-2 text-xs text-[#A1A1AA] leading-relaxed border-t border-[#29292D] pt-4">
            <p className="font-medium text-[#F5F5F5]">Next steps:</p>
            <ol className="list-decimal pl-4 space-y-1 text-[11px] text-[#8E8E93]">
              <li>Open your inbox and click the confirmation link.</li>
              <li>You will be redirected straight to your workspace setup.</li>
              <li>If you don&apos;t see the email, check your Spam or Junk folder.</li>
            </ol>
          </div>

          {/* Resend Action */}
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleResend}
              disabled={isResending || cooldown > 0 || !email}
              className="w-full gap-2 border-[#29292D] hover:bg-[#19191C]"
            >
              <RefreshCw className={`h-4 w-4 ${isResending ? "animate-spin" : ""}`} />
              <span>
                {isResending
                  ? "Sending email..."
                  : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend confirmation email"}
              </span>
            </Button>
          </div>

          {/* Links */}
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
