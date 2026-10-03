import Link from "next/link";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { getOrganizationEntitlement } from "@/lib/organizations/entitlements";
import { SUBSCRIPTION_PLANS } from "@/lib/stripe/config";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Check, Clock, ExternalLink, ArrowLeft, ShieldCheck } from "lucide-react";

export default async function BillingSettingsPage() {
  const activeOrg = await getActiveOrganization();
  const entitlement = activeOrg ? await getOrganizationEntitlement(activeOrg.id) : null;

  // Format trial end date and calculate days remaining
  let trialDaysRemaining: number | null = null;
  let formattedTrialEnd: string | null = null;
  if (entitlement?.trialEnd) {
    const end = new Date(entitlement.trialEnd);
    formattedTrialEnd = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const diffMs = end.getTime() - Date.now();
    trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  // Format next billing date
  let formattedBillingDate: string | null = null;
  if (entitlement?.currentPeriodEnd) {
    const end = new Date(entitlement.currentPeriodEnd);
    formattedBillingDate = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const activePlanConfig = entitlement?.plan
    ? SUBSCRIPTION_PLANS[entitlement.plan]
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/settings"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Billing & Subscription</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            View active plan, trial status, and manage workspace subscription.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-sm">Subscription Plan Overview</CardTitle>
            </div>
            <div>
              {entitlement?.isTrial ? (
                <Badge variant="warning" className="gap-1 font-semibold">
                  <Clock className="h-3 w-3" />
                  <span>Free Trial ({trialDaysRemaining} days remaining)</span>
                </Badge>
              ) : entitlement?.isEntitled ? (
                <Badge variant="success" className="gap-1 font-semibold">
                  <Check className="h-3 w-3" />
                  <span>Active Subscription</span>
                </Badge>
              ) : (
                <Badge variant="secondary">No Active Subscription</Badge>
              )}
            </div>
          </div>
          <CardDescription>
            Billing information associated with <span className="font-semibold text-slate-200">{activeOrg?.name}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                Current Plan
              </span>
              <p className="text-base font-bold text-white mt-1 capitalize">
                {activePlanConfig?.name || entitlement?.plan || "Starter Plan"}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {activePlanConfig ? `$${activePlanConfig.monthlyPriceUsd} / month` : "Configured via Stripe"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                Subscription Status
              </span>
              <p className="text-sm font-medium text-slate-200 mt-1 capitalize">
                {entitlement?.status || "Unknown"}
              </p>
              {entitlement?.isTrial && trialDaysRemaining !== null && (
                <p className="text-[11px] text-amber-400/90 mt-0.5">
                  Trial ends on {formattedTrialEnd || "N/A"} ({trialDaysRemaining} {trialDaysRemaining === 1 ? "day" : "days"} left)
                </p>
              )}
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                Next Billing Date
              </span>
              <p className="text-sm font-medium text-slate-200 mt-1">
                {formattedBillingDate || (entitlement?.isTrial ? formattedTrialEnd : "N/A")}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Automatic renewal via Stripe
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/10 text-blue-400 border border-blue-500/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">
                  Stripe Customer Portal
                </p>
                <p className="text-[11px] text-slate-400">
                  Update payment methods, download invoices, or change subscription tier.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled
              className="gap-2 shrink-0 cursor-not-allowed text-xs"
              title="Stripe Customer Portal will be enabled in Phase 1"
            >
              <span>Manage Billing</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
