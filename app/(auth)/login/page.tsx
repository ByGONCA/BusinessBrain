"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { signInAction, AuthState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OAuthButtons } from "@/components/ui/oauth-buttons";
import { ThemeSelector } from "@/components/theme/theme-selector";

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
        autoFocus
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

  const signUpHref = rawReturnUrl
    ? `/signup?returnUrl=${encodeURIComponent(rawReturnUrl)}`
    : "/signup";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F5] dark:bg-[#0B0B0C] px-4 py-12 text-[#18181B] dark:text-[#F5F5F5] transition-colors relative">
      <div className="absolute top-4 right-4">
        <ThemeSelector />
      </div>

      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#19191C] dark:bg-[#19191C] border border-[#E5E5E0] dark:border-[#29292D] text-[#F5F5F5] shadow-xs hover:scale-105 transition-transform">
            <Sparkles className="h-5 w-5 text-blue-400" />
          </Link>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-[#18181B] dark:text-[#F5F5F5]">
            Welcome back to BusinessBrain
          </h2>
          <p className="mt-1 text-xs text-[#71717A] dark:text-[#A1A1AA]">
            Sign in to access your company workspace and memory layer
          </p>
        </div>

        {/* Auth Card */}
        <div className="mt-8 rounded-2xl border border-[#E5E5E0] dark:border-[#29292D] bg-white dark:bg-[#141416] p-6 shadow-xl">
          <AuthQueryError />

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

          {/* Email / Password Sign In */}
          <LoginForm returnUrl={rawReturnUrl} />

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
