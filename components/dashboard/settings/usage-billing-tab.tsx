"use client";

import * as React from "react";
import Link from "next/link";
import {
  CreditCard,
  Zap,
  TrendingUp,
  Check,
  ExternalLink,
  Plus,
  Coins,
  Cpu,
  Database,
  Users,
  FolderGit2,
  X,
  Sparkles,
} from "lucide-react";
import { OrganizationEntitlement } from "@/lib/organizations/entitlements";
import { SUBSCRIPTION_PLANS } from "@/lib/stripe/config";
import { SubscriptionTier } from "@/lib/stripe/types";
import { cn } from "@/lib/utils";

interface UsageBillingTabProps {
  entitlement: OrganizationEntitlement | null;
  closeSettings: () => void;
}

const CREDIT_PACKS = [
  { id: "pack_500k", name: "Starter Booster", tokens: "500,000", price: "$10", popular: false },
  { id: "pack_2m", name: "Pro Booster", tokens: "2,000,000", price: "$35", popular: true },
  { id: "pack_10m", name: "Enterprise Booster", tokens: "10,000,000", price: "$150", popular: false },
];

export function UsageBillingTab({ entitlement, closeSettings }: UsageBillingTabProps) {
  const [subTab, setSubTab] = React.useState<"overview" | "analytics">("overview");
  const [showAddCreditsModal, setShowAddCreditsModal] = React.useState(false);
  const [selectedPack, setSelectedPack] = React.useState<string>("pack_2m");
  const [purchaseStatus, setPurchaseStatus] = React.useState<string | null>(null);

  const planTier = (entitlement?.plan || "starter") as SubscriptionTier;
  const planConfig = SUBSCRIPTION_PLANS[planTier] || SUBSCRIPTION_PLANS.starter;

  // Usage mock telemetry aligned with plan limits
  const monthlyTokenLimit = planConfig.limits.monthlyAICredits * 1000; // e.g. 1,000,000 for starter
  const tokensUsed = Math.floor(monthlyTokenLimit * 0.28); // 28% used
  const tokensRemaining = monthlyTokenLimit - tokensUsed;
  const tokenPercent = Math.round((tokensUsed / monthlyTokenLimit) * 100);

  const handlePurchaseCredits = () => {
    setPurchaseStatus("Processing credits purchase...");
    setTimeout(() => {
      setPurchaseStatus("Credits allocated successfully! Your token quota has been updated.");
      setTimeout(() => {
        setPurchaseStatus(null);
        setShowAddCreditsModal(false);
      }, 2000);
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Usage & Billing</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
            Monitor plan limits, AI token consumption, active subscriptions, and workspace credits.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddCreditsModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors shrink-0"
        >
          <Coins className="h-3.5 w-3.5" />
          <span>Add Credits</span>
        </button>
      </div>

      {/* Sub Tabs: Overview | Analytics */}
      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-1">
        <button
          type="button"
          onClick={() => setSubTab("overview")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
            subTab === "overview"
              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          )}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setSubTab("analytics")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
            subTab === "analytics"
              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          )}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Analytics</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* SUB-TAB: OVERVIEW                                         */}
      {/* ========================================================= */}
      {subTab === "overview" && (
        <div className="space-y-4">
          {/* Plan & Status Card */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Current Plan</span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white capitalize">
                  {entitlement?.plan || "Starter"} Plan
                </h3>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Check className="h-3 w-3" />
                <span>{entitlement?.isTrial ? "Active 7-Day Trial" : "Active Subscription"}</span>
              </span>
            </div>

            {entitlement?.isTrial && entitlement.trialEnd && (
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between">
                <span>Free trial remaining:</span>
                <span className="font-bold">
                  {Math.max(
                    0,
                    Math.ceil((new Date(entitlement.trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  )}{" "}
                  days left
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500">Billed monthly with automated entitlement verification.</span>
              <Link
                href="/pricing"
                onClick={closeSettings}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <span>Change Plan</span>
                <ExternalLink className="h-3 w-3 text-zinc-400" />
              </Link>
            </div>
          </div>

          {/* AI Credits & Token Balance Card */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-900 dark:text-white">AI Token Quota</h4>
                  <p className="text-[11px] text-zinc-500">Monthly contextual token allowance</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-zinc-900 dark:text-white">
                {tokensUsed.toLocaleString()} / {monthlyTokenLimit.toLocaleString()}
              </span>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${tokenPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                <span>{tokenPercent}% utilized</span>
                <span>{tokensRemaining.toLocaleString()} tokens left</span>
              </div>
            </div>
          </div>

          {/* Plan Limits Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Users className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase">Members</span>
              </div>
              <p className="text-sm font-bold text-zinc-900 dark:text-white">
                1 / {planConfig.limits.maxMembers}
              </p>
              <p className="text-[10px] text-zinc-400">Seats available</p>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <FolderGit2 className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase">Projects</span>
              </div>
              <p className="text-sm font-bold text-zinc-900 dark:text-white">
                Unlimited
              </p>
              <p className="text-[10px] text-zinc-400">Active workspaces</p>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Database className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase">Storage</span>
              </div>
              <p className="text-sm font-bold text-zinc-900 dark:text-white">
                {planConfig.limits.maxStorageMb >= 1000
                  ? `${planConfig.limits.maxStorageMb / 1000} GB`
                  : `${planConfig.limits.maxStorageMb} MB`}
              </p>
              <p className="text-[10px] text-zinc-400">Encrypted files</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB: ANALYTICS                                        */}
      {/* ========================================================= */}
      {subTab === "analytics" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Current Billing Cycle</span>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">AI Token Consumption</h3>
              </div>
              <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                {tokensUsed.toLocaleString()} tokens used
              </span>
            </div>

            {/* Breakdown Bars */}
            <div className="space-y-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-zinc-700 dark:text-zinc-300">Company Brain & Context Memory</span>
                  <span className="font-mono text-zinc-500">117,600 tokens (42%)</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: "42%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-zinc-700 dark:text-zinc-300">Executive Summaries & Action Items</span>
                  <span className="font-mono text-zinc-500">98,000 tokens (35%)</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: "35%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-zinc-700 dark:text-zinc-300">Knowledge Search & Document Parsing</span>
                  <span className="font-mono text-zinc-500">64,400 tokens (23%)</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: "23%" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Historical burn rate summary */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-zinc-400" />
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-white">Consumption Telemetry</h4>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Your workspace is averaging approx. <span className="font-semibold text-zinc-700 dark:text-zinc-300">9,300 tokens/day</span>. At this current velocity, your monthly quota will last through the end of the billing cycle without needing top-ups.
            </p>
          </div>
        </div>
      )}

      {/* Add Credits Modal */}
      {showAddCreditsModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={() => setShowAddCreditsModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-5 shadow-2xl text-zinc-900 dark:text-zinc-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold">Add AI Token Credits</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCreditsModal(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Purchase one-time top-up tokens that never expire and rollover automatically across billing cycles.
              </p>

              <div className="space-y-2">
                {CREDIT_PACKS.map((pack) => (
                  <div
                    key={pack.id}
                    onClick={() => setSelectedPack(pack.id)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                      selectedPack === pack.id
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600 shadow-xs"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-zinc-900 dark:text-white">{pack.name}</span>
                        {pack.popular && (
                          <span className="rounded bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.2">
                            POPULAR
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-zinc-500 mt-0.5">{pack.tokens} tokens</p>
                    </div>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">{pack.price}</span>
                  </div>
                ))}
              </div>

              {purchaseStatus && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium text-center pt-1">
                  {purchaseStatus}
                </p>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowAddCreditsModal(false)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurchaseCredits}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors"
              >
                Confirm Purchase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
