import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";
import {
  getOrFetchStripeFinancialSnapshot,
  StripeFinancialSnapshot,
} from "@/lib/integrations/stripe/analytics";
import { FinanceDashboard } from "@/components/dashboard/finance/finance-dashboard";
import { loadDashboardLayoutAction } from "@/lib/widgets/actions";
import { getDefaultLayout } from "@/lib/widgets/layout-defaults";
import { DashboardLayoutConfig } from "@/lib/widgets/types";
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
  let initialLayout: DashboardLayoutConfig = getDefaultLayout("finance");

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

    // Load custom or default dashboard layout (0 client waterfall)
    try {
      const layoutRes = await loadDashboardLayoutAction({
        organizationId: activeOrg.id,
        dashboardType: "finance",
      });
      initialLayout = layoutRes.layout;
    } catch {
      initialLayout = getDefaultLayout("finance");
    }
  }

  return (
    <FinanceDashboard
      organizationId={activeOrg?.id ?? ""}
      organizationName={activeOrg?.name ?? "Organização"}
      stripeSnapshot={stripeSnapshot}
      isStripeConnected={isStripeConnected}
      userRole={activeOrg?.role ?? "member"}
      initialLayout={initialLayout}
    />
  );
}
