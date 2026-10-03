"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyBrainLoader } from "@/components/ui/company-brain-loader";

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = React.useState<"polling" | "entitled" | "timeout" | "error">("polling");
  const [attempts, setAttempts] = React.useState(0);

  const checkEntitlement = React.useCallback(async () => {
    try {
      const res = await fetch("/api/billing/entitlement", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to verify entitlement");
      }
      const data = await res.json();
      if (data.entitlement?.isEntitled) {
        setStatus("entitled");
        setTimeout(() => {
          router.push("/dashboard");
        }, 1200);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error polling entitlement:", err);
      return false;
    }
  }, [router]);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    let count = 0;
    const maxAttempts = 12; // 12 * 1.5s = 18 seconds

    const poll = async () => {
      count++;
      setAttempts(count);
      const isDone = await checkEntitlement();
      if (isDone) {
        clearInterval(interval);
      } else if (count >= maxAttempts) {
        clearInterval(interval);
        setStatus("timeout");
      }
    };

    // Run first check immediately
    poll();
    interval = setInterval(poll, 1500);

    return () => clearInterval(interval);
  }, [checkEntitlement]);

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center shadow-xl backdrop-blur-sm">
      {status === "polling" && (
        <div className="space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/15 text-blue-400 border border-blue-500/20">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <h2 className="text-lg font-bold text-white">
            Activating your workspace trial...
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            We are verifying your Stripe subscription and provisioning your company workspace.
          </p>
          <div className="pt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-blue-500 transition-all duration-500 rounded-full"
                style={{ width: `${Math.min((attempts / 12) * 100, 95)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {status === "entitled" && (
        <div className="space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-white">
            Free Trial Activated!
          </h2>
          <p className="text-xs text-slate-400">
            Your 7-day unrestricted trial is active. Redirecting you to your dashboard...
          </p>
        </div>
      )}

      {status === "timeout" && (
        <div className="space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-white">
            Confirmation Pending
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your payment information was received. It may take a moment for Stripe webhooks to finalize on your server.
          </p>
          <div className="pt-2 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="primary"
              onClick={async () => {
                setStatus("polling");
                setAttempts(0);
                const isDone = await checkEntitlement();
                if (!isDone) setStatus("timeout");
              }}
              className="w-full gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Re-check Status</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="w-full gap-2"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <Suspense fallback={<CompanyBrainLoader fullScreen={false} />}>
        <CheckoutSuccessContent />
      </Suspense>
    </div>
  );
}
