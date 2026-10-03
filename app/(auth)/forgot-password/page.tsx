"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, ArrowLeft, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { requestPasswordResetAction, AuthState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = React.useActionState<AuthState, FormData>(
    requestPasswordResetAction,
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
            Reset your password
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Enter your email to receive a password reset link
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm">
          {state?.success ? (
            <div className="text-center space-y-4 py-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {state.message}
              </p>
              <Link href="/login" className="inline-block pt-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Sign In</span>
                </Button>
              </Link>
            </div>
          ) : (
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

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
