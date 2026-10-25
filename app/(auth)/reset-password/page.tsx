"use client";

import * as React from "react";
import { ArrowRight, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { updatePasswordAction, AuthState } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { checkPasswordRequirements } from "@/lib/auth/password-rules";

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = React.useActionState<AuthState, FormData>(
    updatePasswordAction,
    {}
  );
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isPasswordTouched, setIsPasswordTouched] = React.useState(false);

  React.useEffect(() => {
    try {
      const supabase = createClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        // Automatically syncs session into cookies if arriving via Supabase client token or hash
      });
      return () => {
        subscription.unsubscribe();
      };
    } catch {
      // Env variables or browser client may not be initialized in test/preview
    }
  }, []);

  const validation = React.useMemo(() => {
    return checkPasswordRequirements(password);
  }, [password]);

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!validation.allMet || password !== confirmPassword) {
      e.preventDefault();
      setIsPasswordTouched(true);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0B0C] px-4 py-12 text-[#F5F5F5]">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#19191C] border border-[#29292D] text-[#F5F5F5] shadow-sm">
            <KeyRound className="h-5 w-5 text-blue-400" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-[#F5F5F5]">
            Set new password
          </h2>
          <p className="mt-1 text-xs text-[#A1A1AA]">
            Enter your new secure password for Company Brain
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-xl border border-[#29292D] bg-[#141416] p-6 shadow-xl">
          <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
            {state?.error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                {state.error}
              </div>
            )}

            <div className="space-y-2">
              <Input
                label="New Password"
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
                    className="text-[#71717A] hover:text-[#F5F5F5] transition-colors focus:outline-none p-1"
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

            <Input
              label="Confirm New Password"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="Confirm new password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={
                confirmPassword.length > 0 && !passwordsMatch
                  ? "Passwords do not match"
                  : undefined
              }
            />

            <Button
              type="submit"
              disabled={isPending || !validation.allMet || !passwordsMatch}
              className="w-full gap-2 mt-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
