"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, CreditCard, Check, Clock, ExternalLink, Link2 } from "lucide-react";
import { OpenSettingsButton } from "./open-settings-button";
import { useLanguage } from "@/lib/i18n";
import { OrganizationWithRole, OrganizationMember } from "@/lib/organizations/types";
import { OrganizationEntitlement } from "@/lib/organizations/entitlements";
import { PlanConfig } from "@/lib/stripe/types";

interface SettingsPageContentProps {
  activeOrg: OrganizationWithRole | null;
  members: OrganizationMember[];
  entitlement: OrganizationEntitlement | null;
  activePlanConfig: PlanConfig | null;
  formattedTrialEnd: string | null;
  trialDaysRemaining: number | null;
  formattedBillingDate: string | null;
}

export function SettingsPageContent({
  activeOrg,
  members,
  entitlement,
  activePlanConfig,
  formattedTrialEnd,
  trialDaysRemaining,
  formattedBillingDate,
}: SettingsPageContentProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t.settingsPage.title}
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t.settingsPage.description}
          </p>
        </div>
        <OpenSettingsButton />
      </div>

      {/* Workspace General Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            <CardTitle className="text-sm">{t.settingsPage.orgDetails}</CardTitle>
          </div>
          <CardDescription>
            {t.settingsPage.orgDetailsDesc}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 p-3">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
                {t.settingsPage.companyName}
              </span>
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mt-1">
                {activeOrg?.name}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 p-3">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
                {t.settingsPage.workspaceSlug}
              </span>
              <p className="text-sm font-mono text-zinc-800 dark:text-zinc-200 mt-1">
                /{activeOrg?.slug}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* External Integrations */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-blue-400" />
                <CardTitle className="text-sm">{t.settingsPage.integrationsTitle}</CardTitle>
              </div>
              <CardDescription className="mt-1">
                {t.settingsPage.integrationsDesc}
              </CardDescription>
            </div>
            <Link href="/dashboard/settings/integrations">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <span>{t.settingsPage.manageIntegrations}</span>
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
      </Card>

      {/* Live Subscription & Billing Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              <CardTitle className="text-sm">{t.settingsPage.subBillingTitle}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {entitlement?.isTrial ? (
                <Badge variant="warning" className="gap-1 font-semibold">
                  <Clock className="h-3 w-3" />
                  <span>
                    {t.settings.billingTab.activeTrial} ({trialDaysRemaining} {trialDaysRemaining === 1 ? t.common.day : t.common.days} {t.common.leftInTrial})
                  </span>
                </Badge>
              ) : entitlement?.isEntitled ? (
                <Badge variant="success" className="gap-1 font-semibold">
                  <Check className="h-3 w-3" />
                  <span>{t.settings.billingTab.activeSubscription}</span>
                </Badge>
              ) : (
                <Badge variant="secondary">No Active Subscription</Badge>
              )}
            </div>
          </div>
          <CardDescription>
            {t.settingsPage.subBillingDesc}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 p-3.5">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
                {t.settings.billingTab.currentPlan}
              </span>
              <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1 capitalize">
                {activePlanConfig?.name || entitlement?.plan || "Starter Plan"}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                {activePlanConfig ? `$${activePlanConfig.monthlyPriceUsd} / month` : "Configured via Stripe"}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 p-3.5">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
                {t.settingsPage.trialStatus}
              </span>
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mt-1">
                {entitlement?.isTrial
                  ? `Ends on ${formattedTrialEnd || "N/A"}`
                  : t.settingsPage.completed}
              </p>
              {entitlement?.isTrial && trialDaysRemaining !== null && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400/90 mt-0.5">
                  {trialDaysRemaining} {trialDaysRemaining === 1 ? t.common.day : t.common.days} {t.common.leftInTrial}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 p-3.5">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
                {t.settingsPage.nextBillingDate}
              </span>
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mt-1">
                {formattedBillingDate || (entitlement?.isTrial ? formattedTrialEnd : "N/A")}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                {t.common.automaticRenewal}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-4">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                {t.settingsPage.manageInvoices}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                {t.settingsPage.stripeCustomerPortal}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/settings/billing">
                <Button variant="outline" size="sm">
                  {t.settings.billingTab.billingDetails}
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="secondary" size="sm">
                  {t.settings.billingTab.changePlan}
                </Button>
              </Link>
              <Button variant="outline" size="sm" disabled className="gap-1.5 opacity-60">
                <ExternalLink className="h-3.5 w-3.5" />
                <span>{t.common.manageBilling}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization Members List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              <CardTitle className="text-sm">{t.settingsPage.teamMembers}</CardTitle>
            </div>
            <Badge variant="secondary">{members.length} {t.common.total}</Badge>
          </div>
          <CardDescription>
            {t.settingsPage.teamMembersDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {member.profile?.email ? member.profile.email.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-900 dark:text-zinc-200">
                      {member.profile?.full_name || member.profile?.email || "Workspace Member"}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {member.profile?.email}
                    </p>
                  </div>
                </div>

                <Badge variant={member.role === "owner" ? "default" : "secondary"} className="capitalize">
                  {member.role === "owner" ? t.settings.peopleTab.owner : member.role === "admin" ? t.settings.peopleTab.admin : t.settings.peopleTab.member}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
