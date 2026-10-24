import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";
import {
  getOrFetchStripeFinancialSnapshot,
  StripeFinancialSnapshot,
} from "@/lib/integrations/stripe/analytics";
import { FinanceDashboard } from "@/components/dashboard/finance/finance-dashboard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finanças | BusinessBrain",
  description:
    "Painel de controlo financeiro, métricas de receita, faturação, economia SaaS e retenção no BusinessBrain.",
};

export default async function FinancePage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  let stripeSnapshot: StripeFinancialSnapshot | null = null;
  let isStripeConnected = false;

  if (activeOrg) {
    const supabase = await createClient();
    const { data: stripeIntegrations } = await supabase
      .from("organization_integrations")
      .select("provider_account_id, status")
      .eq("organization_id", activeOrg.id)
      .eq("provider", "stripe")
      .eq("status", "connected")
      .order("updated_at", { ascending: false })
      .limit(1);

    const stripeIntegration = stripeIntegrations?.[0] || null;

    if (stripeIntegration) {
      isStripeConnected = true;
      const snapshotResult = await getOrFetchStripeFinancialSnapshot(
        supabase,
        activeOrg.id
      );
      stripeSnapshot = snapshotResult.snapshot;
    }
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
