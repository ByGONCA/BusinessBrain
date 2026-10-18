import { redirect } from "next/navigation";
import Link from "next/link";
import crypto from "node:crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateInvitationServerToken } from "@/lib/security/authorization";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit";
import { Building2, ShieldCheck, ArrowRight, AlertTriangle, Clock } from "lucide-react";
import { AcceptInvitationButton } from "@/components/invitations/accept-invitation-button";

interface InvitePageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    redirect("/login");
  }

  const cleanToken = token.trim();

  // 1. Distributed Rate Limiting via PostgreSQL rate_limit_buckets (Shared across Vercel instances)
  const clientIp = await getClientIp();
  const rl = await rateLimit("invite-view", clientIp, {
    limit: 10,
    windowSeconds: 60,
    failClosed: false,
  });

  if (!rl.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 text-zinc-100">
        <div className="max-w-md w-full p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Too Many Requests</h1>
          <p className="text-sm text-zinc-400">
            You have made too many attempts to view invitation links. Please wait a moment before trying again.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 2. Compute SHA-256 hash of incoming raw token
  const tokenHash = crypto.createHash("sha256").update(cleanToken).digest("hex");

  // 3. Fetch invitation details via secure Server Gateway (RPC) with cryptographic proof
  let invitation: {
    id: string;
    organization_id: string;
    organization_name: string;
    organization_slug: string;
    email: string;
    role: string;
    status: string;
    expires_at: string;
    is_expired?: boolean;
  } | null = null;

  try {
    const serviceClient = createServiceClient();
    const serverToken = generateInvitationServerToken(tokenHash);

    const { data: rpcData, error: rpcError } = await serviceClient.rpc("get_invitation_details", {
      p_token_hash: tokenHash,
      p_server_token: serverToken,
    });

    if (!rpcError && rpcData && rpcData.length > 0) {
      invitation = rpcData[0];
    } else if (rpcError) {
      // Fail closed: Never query plaintext tokens.
      console.warn("RPC get_invitation_details failed or returned error:", rpcError.message);
    }
  } catch (err) {
    // Fail closed: If error occurs, invitation remains null
    console.warn("Error calling get_invitation_details gateway:", err);
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 text-zinc-100">
        <div className="max-w-md w-full p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Invalid Invitation</h1>
          <p className="text-sm text-zinc-400">
            This invitation link is invalid or may have been deleted. Please ask the organization owner for a new invite.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = new Date(invitation.expires_at) < new Date();
  const orgName = invitation.organization_name || "the workspace";

  if (invitation.status !== "pending" || isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 text-zinc-100">
        <div className="max-w-md w-full p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Invitation Expired</h1>
          <p className="text-sm text-zinc-400">
            This invitation to join <strong>{orgName}</strong> has {isExpired ? "expired" : invitation.status}. Please request a fresh invitation link.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors"
            >
              Sign In to BusinessBrain
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 text-zinc-100">
      <div className="max-w-md w-full p-7 rounded-2xl bg-[#161618] border border-zinc-800 text-center space-y-6 shadow-2xl">
        {/* Workspace Avatar / Icon */}
        <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
          <Building2 className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-white">Join {orgName}</h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            You have been invited to collaborate in <strong>{orgName}</strong> as an{" "}
            <span className="font-semibold text-zinc-200 capitalize">{invitation.role}</span>.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 text-left space-y-2 text-xs">
          <div className="flex items-center justify-between text-zinc-400">
            <span>Invited Email:</span>
            <span className="font-mono text-zinc-200 text-[11px]">{invitation.email}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-400">
            <span>Role:</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3" />
              {invitation.role}
            </span>
          </div>
        </div>

        {user ? (
          <AcceptInvitationButton token={token} orgName={orgName} />
        ) : (
          <div className="space-y-2.5">
            <Link
              href={`/login?returnUrl=${encodeURIComponent(`/invite/${token}`)}`}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg transition-colors cursor-pointer"
            >
              <span>Sign In to Accept</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href={`/signup?returnUrl=${encodeURIComponent(`/invite/${token}`)}`}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 transition-colors"
            >
              <span>Create an Account</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
