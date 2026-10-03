"use client";

import * as React from "react";
import { Sparkles, ArrowRight, Loader2, KeyRound } from "lucide-react";
import { updatePasswordAction, AuthState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = React.useActionState<AuthState, FormData>(
    updatePasswordAction,
    {}
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
            <KeyRound className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-white">
            Set new password
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Enter your new secure password for Company Brain
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm">
          <form action={formAction} className="space-y-4">
            {state?.error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                {state.error}
              </div>
            )}

            <Input
              label="New Password"
              name="password"
              type="password"
              placeholder="At least 6 characters"
              required
              autoComplete="new-password"
            />

            <Input
              label="Confirm New Password"
              name="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              required
              autoComplete="new-password"
            />

            <Button
              type="submit"
              disabled={isPending}
              className="w-full gap-2 mt-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Updating password...</span>
                </>
              ) : (
                <>
                  <span>Save Password & Continue</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
