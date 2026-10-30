"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { signUpAction, AuthState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OAuthButtons } from "@/components/ui/oauth-buttons";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { checkPasswordRequirements } from "@/lib/auth/password-rules";
import { ThemeSelector } from "@/components/theme/theme-selector";

function SignUpForm({ returnUrl }: { returnUrl: string }) {
  const [state, formAction, isPending] = React.useActionState<AuthState, FormData>(
    signUpAction,
    {}
  );
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isPasswordTouched, setIsPasswordTouched] = React.useState(false);

  const validation = React.useMemo(() => {
    return checkPasswordRequirements(password);
  }, [password]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!validation.allMet) {
      e.preventDefault();
      setIsPasswordTouched(true);
    }
  };

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
      {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}

      {state?.error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
          {state.error}
        </div>
      )}

      <Input
        label="Full Name"
        name="fullName"
        placeholder="Alex Smith"
        required
        autoComplete="name"
      />

      <Input
        label="Work Email"
        name="email"
        type="email"
        placeholder="alex@company.com"
        required
        autoComplete="email"
      />

      <div className="space-y-2">
        <Input
          label="Password"
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder="Min. 8 chars (Aa, 123, & #$!)"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setIsPasswordTouched(true);
          }}
          onFocus={() => setIsPasswordTouched(true)}
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-[#71717A] hover:text-[#18181B] dark:hover:text-[#F5F5F5] transition-colors focus:outline-none p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          }
        />

        {/* Real-time Password Requirements Checklist */}
        <PasswordChecklist
          validation={validation}
          touched={isPasswordTouched || password.length > 0}
        />
      </div>

      {/* Consents */}
      <div className="space-y-2.5 pt-1 text-xs text-[#52525B] dark:text-[#A1A1AA]">
        {/* Required Terms Consent */}
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            name="termsConsent"
            required
            className="mt-0.5 h-4 w-4 rounded border-[#D4D4D8] dark:border-[#29292D] bg-white dark:bg-[#09090A] text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
          />
          <span className="leading-snug text-[#52525B] dark:text-[#A1A1AA]">
            I agree to the{" "}
            <Link href="/terms" className="text-[#18181B] dark:text-[#F5F5F5] underline hover:text-blue-600 transition-colors">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-[#18181B] dark:text-[#F5F5F5] underline hover:text-blue-600 transition-colors">
              Privacy Policy
            </Link>.{" "}
            <span className="text-red-500">*</span>
          </span>
        </label>

        {/* Optional Marketing Consent (NOT pre-checked) */}
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            name="marketingConsent"
            defaultChecked={false}
            className="mt-0.5 h-4 w-4 rounded border-[#D4D4D8] dark:border-[#29292D] bg-white dark:bg-[#09090A] text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
          />
          <span className="leading-snug text-[#71717A]">
            I want to receive product updates, news and occasional marketing emails.
          </span>
        </label>
      </div>

      <Button
        type="submit"
        disabled={isPending || !validation.allMet}
        title={!validation.allMet ? "Please satisfy all password requirements" : undefined}
        className="w-full gap-2 mt-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Creating account...</span>
          </>
        ) : (
          <>
            <span>Create Account</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

function SignUpContent() {
  const searchParams = useSearchParams();
  const rawReturnUrl = searchParams.get("returnUrl") || "";

  const loginHref = rawReturnUrl
    ? `/login?returnUrl=${encodeURIComponent(rawReturnUrl)}`
    : "/login";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F5] dark:bg-[#0B0B0C] px-4 py-12 text-[#18181B] dark:text-[#F5F5F5] transition-colors relative">
      <div className="absolute top-4 right-4">
        <ThemeSelector />
      </div>

      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#19191C] border border-[#E5E5E0] dark:border-[#29292D] text-[#F5F5F5] shadow-xs hover:scale-105 transition-transform">
            <Sparkles className="h-5 w-5 text-blue-400" />
          </Link>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-[#18181B] dark:text-[#F5F5F5]">
            Create your account
          </h2>
          <p className="mt-1 text-xs text-[#71717A] dark:text-[#A1A1AA]">
            Start building your company&apos;s memory and intelligence layer
          </p>
        </div>

        {/* Auth Card */}
        <div className="mt-8 rounded-2xl border border-[#E5E5E0] dark:border-[#29292D] bg-white dark:bg-[#141416] p-6 shadow-xl">
          {/* OAuth Providers */}
          <OAuthButtons returnUrl={rawReturnUrl} />

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#E5E5E0] dark:border-[#29292D]" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
              <span className="bg-white dark:bg-[#141416] px-2 text-[#71717A] font-medium">
                Or with email
              </span>
            </div>
          </div>

          <SignUpForm returnUrl={rawReturnUrl} />

          <div className="mt-6 border-t border-[#E5E5E0] dark:border-[#29292D] pt-4 text-center text-xs text-[#71717A] dark:text-[#A1A1AA]">
            Already have an account?{" "}
            <Link
              href={loginHref}
              className="font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <React.Suspense fallback={null}>
      <SignUpContent />
    </React.Suspense>
  );
}
