"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { acceptInvitationAction } from "@/lib/invitations/actions";
import { Loader2, ArrowRight } from "lucide-react";

export function AcceptInvitationButton({ token, orgName }: { token: string; orgName: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleAccept = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await acceptInvitationAction(token);
      if (res.success) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(res.error || "Failed to accept invitation.");
        setLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 text-center">
          {error}
        </div>
      )}
      <button
        type="button"
        disabled={loading}
        onClick={handleAccept}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white shadow-lg transition-colors cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Joining {orgName}...</span>
          </>
        ) : (
          <>
            <span>Accept & Join {orgName}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </>
        )}
      </button>
    </div>
  );
}
