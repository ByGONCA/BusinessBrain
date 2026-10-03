"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { signInAction, AuthState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OAuthButtons } from "@/components/ui/oauth-buttons";

export default function LoginPage() {
  const [state, formAction, isPending] = React.useActionState<AuthState, FormData>(
    signInAction,
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
            Welcome back to Company Brain
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Sign in to access your company workspace and memory layer
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
              label="Work Email"
              name="email"
              type="email"
              placeholder="alex@company.com"
              required
              autoComplete="email"
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
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

          <div className="mt-6 border-t border-slate-800 pt-4 text-center text-xs text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
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
