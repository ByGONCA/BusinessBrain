"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { signUpAction, AuthState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OAuthButtons } from "@/components/ui/oauth-buttons";

export default function SignUpPage() {
  const [state, formAction, isPending] = React.useActionState<AuthState, FormData>(
    signUpAction,
    {}
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-white">
            Create your account
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Start building your company&apos;s memory and intelligence layer
          </p>
        </div>

        {/* Auth Card */}
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm">
          {/* OAuth Providers */}
          <OAuthButtons />

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
              <span className="bg-slate-900/90 px-2 text-slate-500 font-medium">
                Or with email
              </span>
            </div>
          </div>

          <form action={formAction} className="space-y-4">
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

            <Input
              label="Password"
              name="password"
              type="password"
              placeholder="At least 6 characters"
              required
              autoComplete="new-password"
            />

            {/* Consents */}
            <div className="space-y-2.5 pt-1 text-xs text-slate-300">
              {/* Required Terms Consent */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="termsConsent"
                  required
                  className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                />
                <span className="leading-snug text-slate-400">
                  I agree to the{" "}
                  <span className="text-slate-200 underline">Terms of Service</span> and{" "}
                  <span className="text-slate-200 underline">Privacy Policy</span>.{" "}
                  <span className="text-red-400">*</span>
                </span>
              </label>

              {/* Optional Marketing Consent (NOT pre-checked) */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="marketingConsent"
                  defaultChecked={false}
                  className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                />
                <span className="leading-snug text-slate-400">
                  I want to receive product updates, news and occasional marketing emails.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="w-full gap-2 mt-2"
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

          <div className="mt-6 border-t border-slate-800 pt-4 text-center text-xs text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
