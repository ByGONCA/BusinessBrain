"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyBrainLoader } from "@/components/ui/company-brain-loader";

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = React.useState<"polling" | "entitled" | "timeout" | "error">("polling");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [attempts, setAttempts] = React.useState(0);
  const maxAttempts = 6; // 6 attempts * 2.5s = ~15s max bounded window

  const isPollingRef = React.useRef(false);

  const checkEntitlement = React.useCallback(async (): Promise<{ done: boolean; entitled: boolean; throttled?: boolean }> => {
    try {
      const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
      const res = await fetch(`/api/billing/entitlement${query}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (res.status === 401) {
        window.location.href = "/login?redirectedFrom=/checkout/success";
        return { done: true, entitled: false };
      }

      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || "Acesso negado à confirmação de faturação.");
        setStatus("error");
        return { done: true, entitled: false };
      }

      if (res.status === 429) {
        // Upstream or endpoint rate limit encountered; back off without terminating
        return { done: false, entitled: false, throttled: true };
      }

      if (!res.ok) {
        return { done: false, entitled: false };
      }

      const data = await res.json();
      if (data.entitlement?.isEntitled) {
        setStatus("entitled");
        setTimeout(() => {
          // Hard navigation ensures clean server-side layout re-evaluation without stale client caches
          window.location.href = "/dashboard";
        }, 1200);
        return { done: true, entitled: true };
      }

      return { done: false, entitled: false };
    } catch (err: unknown) {
      console.error("Error checking entitlement:", err);
      return { done: false, entitled: false };
    }
  }, [sessionId]);

  React.useEffect(() => {
    let isCancelled = false;
    let timerId: NodeJS.Timeout | null = null;
    let count = 0;

    const runPoll = async () => {
      if (isCancelled || isPollingRef.current) return;
      isPollingRef.current = true;

      count++;
      setAttempts(count);

      const result = await checkEntitlement();
      isPollingRef.current = false;

      if (isCancelled) return;

      if (result.done) {
        return; // Terminal state (entitled or error) reached; stop polling
      }

      if (count >= maxAttempts) {
        setStatus("timeout");
        return;
      }

      // Schedule next attempt with appropriate backoff (extended if throttled)
      const delay = result.throttled ? 3500 : 2500;
      timerId = setTimeout(runPoll, delay);
    };

    // Execute initial check immediately
    runPoll();

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [checkEntitlement]);

  const handleManualRecheck = async () => {
    if (isPollingRef.current) return;
    setStatus("polling");
    setAttempts(1);
    setErrorMessage(null);

    isPollingRef.current = true;
    const result = await checkEntitlement();
    isPollingRef.current = false;

    if (!result.done) {
      setStatus("timeout");
    }
  };

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
                style={{ width: `${Math.min((attempts / maxAttempts) * 100, 95)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Verification attempt {attempts} of {maxAttempts}
            </p>
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

      {status === "error" && (
        <div className="space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-400 border border-red-500/20">
            <XCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-white">
            Checkout Error
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {errorMessage || "Não foi possível confirmar os detalhes da subscrição."}
          </p>
          <div className="pt-2">
            <Button
              variant="outline"
              onClick={() => router.push("/pricing")}
              className="w-full gap-2"
            >
              <span>Back to Pricing</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
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
            Your payment information was received. Webhook confirmation is taking a few moments to finalize on your server.
          </p>
          <div className="pt-2 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="primary"
              onClick={handleManualRecheck}
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
