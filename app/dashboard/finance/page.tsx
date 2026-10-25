import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";
import {
  getOrFetchStripeFinancialSnapshot,
  StripeFinancialSnapshot,
} from "@/lib/integrations/stripe/analytics";
import { FinanceDashboard } from "@/components/dashboard/finance/finance-dashboard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Corporate Finance | BusinessBrain",
  description:
    "Corporate finance dashboard, revenue trajectory, SaaS economics, and retention cohorts in BusinessBrain.",
};

export default async function FinancePage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  let stripeSnapshot: StripeFinancialSnapshot | null = null;
  let isStripeConnected = false;

  if (activeOrg) {
    const supabase = await createClient();
    const snapshotResult = await getOrFetchStripeFinancialSnapshot(
      supabase,
      activeOrg.id
    );

    isStripeConnected =
      snapshotResult.isConnected ??
      (snapshotResult.error !== "Stripe not connected for this workspace.");
    stripeSnapshot = snapshotResult.snapshot;
  }

  return (
    <FinanceDashboard
      organizationId={activeOrg?.id ?? ""}
      organizationName={activeOrg?.name ?? "Organização"}
      stripeSnapshot={stripeSnapshot}
      isStripeConnected={isStripeConnected}
      userRole={activeOrg?.role ?? "member"}
    />
  );
}
