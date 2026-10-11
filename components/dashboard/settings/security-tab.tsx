"use client";

import * as React from "react";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Lock,
  Smartphone,
  Laptop,
  LogOut,
  Github,
  QrCode,
  Check,
} from "lucide-react";
import {
  resendVerificationEmailAction,
  updateEmailAddressAction,
  changePasswordAction,
} from "@/lib/settings/actions";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";

interface SecurityTabProps {
  user: {
    id: string;
    email?: string;
    email_confirmed_at?: string | null;
    created_at?: string;
    app_metadata?: {
      provider?: string;
      providers?: string[];
      [key: string]: unknown;
    };
    identities?: Array<{
      provider: string;
      id: string;
      created_at?: string;
    }>;
  };
}

export function SecurityTab({ user }: SecurityTabProps) {
  const supabase = React.useMemo(() => createClient(), []);

  // Email verification state
  const isEmailConfirmed = Boolean(user.email_confirmed_at);
  const [resendingEmail, setResendingEmail] = React.useState(false);
  const [resendStatus, setResendStatus] = React.useState<{ success?: boolean; message?: string } | null>(null);

  // Email update state
  const [newEmail, setNewEmail] = React.useState("");
  const [updatingEmail, setUpdatingEmail] = React.useState(false);
  const [emailStatus, setEmailStatus] = React.useState<{ success?: boolean; message?: string; error?: string } | null>(null);

  // Password change state
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [updatingPassword, setUpdatingPassword] = React.useState(false);
  const [passwordStatus, setPasswordStatus] = React.useState<{ success?: boolean; message?: string; error?: string } | null>(null);

  // Password reset via email
  const [sendingResetLink, setSendingResetLink] = React.useState(false);
  const [resetLinkStatus, setResetLinkStatus] = React.useState<{ success?: boolean; message?: string } | null>(null);

  // MFA / 2FA State
  const [mfaFactors, setMfaFactors] = React.useState<Array<{ id: string; factor_type: string; status: string }>>([]);
  const [loadingMfa, setLoadingMfa] = React.useState(false);
  const [enrollingMfa, setEnrollingMfa] = React.useState(false);
  const [enrollData, setEnrollData] = React.useState<{
    id: string;
    totp?: { qr_code?: string; secret?: string; uri?: string };
  } | null>(null);
  const [verifyCode, setVerifyCode] = React.useState("");
  const [mfaError, setMfaError] = React.useState<string | null>(null);
  const [mfaSuccess, setMfaSuccess] = React.useState<string | null>(null);

  // Sessions state
  const [signingOutOthers, setSigningOutOthers] = React.useState(false);
  const [sessionMessage, setSessionMessage] = React.useState<string | null>(null);

  // Fetch MFA factors on mount
  const checkMfaStatus = React.useCallback(async () => {
    try {
      setLoadingMfa(true);
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!error && data) {
        setMfaFactors(
          (data.totp || []).map((f) => ({
            id: f.id,
            factor_type: "totp",
            status: f.status,
          }))
        );
      }
    } catch {
      // Graceful fallback if MFA is not enabled in Supabase project config
    } finally {
      setLoadingMfa(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    checkMfaStatus();
  }, [checkMfaStatus]);

  const hasActiveMfa = mfaFactors.some((f) => f.status === "verified");

  const handleStartMfaEnrollment = async () => {
    setMfaError(null);
    setMfaSuccess(null);
    setEnrollingMfa(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Company Brain Authenticator",
      });
      if (error) {
        setMfaError(error.message);
        setEnrollingMfa(false);
        return;
      }
      setEnrollData(data);
    } catch (err: unknown) {
      setMfaError((err as Error).message || "Failed to start 2FA enrollment");
      setEnrollingMfa(false);
    }
  };

  const handleVerifyMfaEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollData || !verifyCode.trim()) return;
    setMfaError(null);
    try {
      const challengeRes = await supabase.auth.mfa.challenge({ factorId: enrollData.id });
      if (challengeRes.error) {
        setMfaError(challengeRes.error.message);
        return;
      }

      const verifyRes = await supabase.auth.mfa.verify({
        factorId: enrollData.id,
        challengeId: challengeRes.data.id,
        code: verifyCode.trim(),
      });

      if (verifyRes.error) {
        setMfaError(verifyRes.error.message);
        return;
      }

      setMfaSuccess("Two-factor authentication successfully enabled!");
      setEnrollData(null);
      setVerifyCode("");
      setEnrollingMfa(false);
      checkMfaStatus();
    } catch (err: unknown) {
      setMfaError((err as Error).message || "Verification failed");
    }
  };

  const handleDisableMfa = async (factorId: string) => {
    setMfaError(null);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        setMfaError(error.message);
      } else {
        setMfaSuccess("Two-factor authentication disabled.");
        checkMfaStatus();
      }
    } catch (err: unknown) {
      setMfaError((err as Error).message || "Failed to unenroll 2FA");
    }
  };

  const handleSignOutOthers = async () => {
    setSigningOutOthers(true);
    setSessionMessage(null);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) {
        setSessionMessage(`Error: ${error.message}`);
      } else {
        setSessionMessage("All other active sessions have been signed out.");
      }
    } catch {
      setSessionMessage("Failed to sign out other sessions.");
    } finally {
      setSigningOutOthers(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    setResendStatus(null);
    try {
      const res = await resendVerificationEmailAction();
      if (res.success) {
        setResendStatus({ success: true, message: res.message || "Verification email sent!" });
      } else {
        setResendStatus({ success: false, message: res.error || "Failed to resend." });
      }
    } finally {
      setResendingEmail(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setUpdatingEmail(true);
    setEmailStatus(null);
    try {
      const res = await updateEmailAddressAction(newEmail.trim());
      if (res.success) {
        setEmailStatus({ success: true, message: res.message });
        setNewEmail("");
      } else {
        setEmailStatus({ success: false, error: res.error });
      }
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordStatus({ success: false, error: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ success: false, error: "Passwords do not match." });
      return;
    }
    setUpdatingPassword(true);
    setPasswordStatus(null);
    try {
      const res = await changePasswordAction(newPassword);
      if (res.success) {
        setPasswordStatus({ success: true, message: res.message });
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordStatus({ success: false, error: res.error });
      }
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user.email) return;
    setSendingResetLink(true);
    setResetLinkStatus(null);
    try {
      const formData = new FormData();
      formData.append("email", user.email);
      const res = await requestPasswordResetAction(null, formData);
      if (res.success) {
        setResetLinkStatus({ success: true, message: "Password reset link sent to your email." });
      } else {
        setResetLinkStatus({ success: false, message: res.error || "Failed to send reset link." });
      }
    } finally {
      setSendingResetLink(false);
    }
  };

  const providers = user.app_metadata?.providers || [user.app_metadata?.provider || "email"];

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Security & Authentication</h2>
      </div>

      {/* Account Verification Status */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isEmailConfirmed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            )}
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {isEmailConfirmed ? "Email Verified" : "Email Verification Pending"}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {isEmailConfirmed
                  ? `Your account (${user.email}) is verified.`
                  : `Please check ${user.email} and confirm your address.`}
              </p>
            </div>
          </div>
          {!isEmailConfirmed && (
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendingEmail}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {resendingEmail ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3" />
                  <span>Resend Email</span>
                </>
              )}
            </button>
          )}
        </div>

        {resendStatus && (
          <p
            className={`text-xs ${
              resendStatus.success ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
            }`}
          >
            {resendStatus.message}
          </p>
        )}
      </div>

      {/* ========================================================= */}
      {/* TWO-FACTOR AUTHENTICATION (MFA / TOTP)                    */}
      {/* ========================================================= */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Two-Factor Authentication (2FA)
            </h3>
          </div>
          {hasActiveMfa && (
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Enabled
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Protect your account with a time-based one-time password (TOTP) from Google Authenticator, 1Password, or Authy.
        </p>

        {mfaError && <p className="text-xs text-red-500">{mfaError}</p>}
        {mfaSuccess && <p className="text-xs text-emerald-600 dark:text-emerald-400">{mfaSuccess}</p>}

        {!hasActiveMfa && !enrollingMfa && (
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d]">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Authenticator App</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Generate 6-digit codes on your mobile authenticator app.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartMfaEnrollment}
              disabled={loadingMfa}
              className="rounded-lg bg-zinc-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Set up 2FA
            </button>
          </div>
        )}

        {/* Enrollment Active Modal / Drawer */}
        {enrollingMfa && enrollData && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 p-4 space-y-3">
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Scan this QR code with your Authenticator App
            </p>
            {enrollData.totp?.qr_code && (
              <div className="flex justify-center p-2 bg-white rounded-lg border border-zinc-200 max-w-[200px] mx-auto">
                <img
                  src={enrollData.totp.qr_code}
                  alt="2FA QR Code"
                  className="h-44 w-44 object-contain"
                />
              </div>
            )}
            {enrollData.totp?.secret && (
              <div className="text-center space-y-1">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Or enter secret key:</p>
                <code className="text-xs font-mono font-bold bg-white dark:bg-zinc-800 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 select-all">
                  {enrollData.totp.secret}
                </code>
              </div>
            )}
            <form onSubmit={handleVerifyMfaEnrollment} className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="6-digit verification code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                maxLength={6}
                className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-mono text-center tracking-widest text-zinc-900 dark:text-zinc-100 placeholder:tracking-normal focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={verifyCode.length < 6}
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Verify & Activate
              </button>
              <button
                type="button"
                onClick={() => {
                  setEnrollingMfa(false);
                  setEnrollData(null);
                }}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {hasActiveMfa && (
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d]">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  TOTP Authenticator Active
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Your account requires a code when logging in from new devices.
                </p>
              </div>
            </div>
            {mfaFactors.map(
              (f) =>
                f.status === "verified" && (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleDisableMfa(f.id)}
                    className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
                  >
                    Disable 2FA
                  </button>
                )
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* CONNECTED SIGN-IN METHODS                                 */}
      {/* ========================================================= */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
          Connected Sign-in Methods
        </h3>
        <div className="space-y-2">
          {/* Email / Password */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d]">
            <div className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Email & Password</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{user.email}</p>
              </div>
            </div>
            <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
              Active
            </span>
          </div>

          {/* GitHub OAuth */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d]">
            <div className="flex items-center gap-2.5">
              <Github className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">GitHub OAuth</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {providers.includes("github") ? "Connected to your GitHub profile" : "Not connected"}
                </p>
              </div>
            </div>
            {providers.includes("github") ? (
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Connected
              </span>
            ) : (
              <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                Available
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ACTIVE SESSIONS & DEVICE MANAGEMENT                       */}
      {/* ========================================================= */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Laptop className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Active Sessions
            </h3>
          </div>
          <button
            type="button"
            onClick={handleSignOutOthers}
            disabled={signingOutOthers}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {signingOutOthers ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Signing out...</span>
              </>
            ) : (
              <>
                <LogOut className="h-3 w-3 text-red-500" />
                <span>Sign out all other sessions</span>
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Devices and browsers that currently have an authenticated session to your account.
        </p>

        {sessionMessage && (
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{sessionMessage}</p>
        )}

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              <Laptop className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Current Web Session</p>
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="Active now" />
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                This browser &bull; Active right now
              </p>
            </div>
          </div>
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            This Device
          </span>
        </div>
      </div>

      {/* Change Password */}
      <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            Change Password
          </h3>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">New Password</label>
            <input
              type="password"
              placeholder="Minimum 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Confirm New Password</label>
            <input
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleSendResetEmail}
              disabled={sendingResetLink}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
            >
              {sendingResetLink ? "Sending..." : "Send reset link to email instead"}
            </button>

            <button
              type="submit"
              disabled={updatingPassword || !newPassword}
              className="rounded-lg bg-zinc-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50"
            >
              {updatingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>

          {passwordStatus && (
            <p
              className={`text-xs ${
                passwordStatus.success ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
              }`}
            >
              {passwordStatus.message || passwordStatus.error}
            </p>
          )}

          {resetLinkStatus && (
            <p
              className={`text-xs ${
                resetLinkStatus.success ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
              }`}
            >
              {resetLinkStatus.message}
            </p>
          )}
        </form>
      </div>

      {/* Change Email Address */}
      <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            Change Email Address
          </h3>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          A confirmation link will be sent to the new email address before it becomes active.
        </p>

        <form onSubmit={handleUpdateEmail} className="flex gap-2">
          <input
            type="email"
            placeholder="New email address"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="submit"
            disabled={updatingEmail || !newEmail.trim()}
            className="rounded-lg bg-zinc-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {updatingEmail ? "Sending..." : "Update Email"}
          </button>
        </form>

        {emailStatus && (
          <p
            className={`text-xs ${
              emailStatus.success ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
            }`}
          >
            {emailStatus.message || emailStatus.error}
          </p>
        )}
      </div>
    </div>
  );
}
