import { getActiveOrganization, getOrganizationMembers } from "@/lib/organizations/queries";
import { getOrganizationEntitlement } from "@/lib/organizations/entitlements";
import { SUBSCRIPTION_PLANS } from "@/lib/stripe/config";
import { SettingsPageContent } from "@/components/dashboard/settings/settings-page-content";

export default async function SettingsPage() {
  const activeOrg = await getActiveOrganization();
  const [members, entitlement] = activeOrg
    ? await Promise.all([
        getOrganizationMembers(activeOrg.id),
        getOrganizationEntitlement(activeOrg.id),
      ])
    : [[], null];

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
    <SettingsPageContent
      activeOrg={activeOrg}
      members={members}
      entitlement={entitlement}
      activePlanConfig={activePlanConfig}
      formattedTrialEnd={formattedTrialEnd}
      trialDaysRemaining={trialDaysRemaining}
      formattedBillingDate={formattedBillingDate}
    />
  );
}
