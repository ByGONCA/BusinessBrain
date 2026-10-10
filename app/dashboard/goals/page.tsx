import { Target } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";

export default async function GoalsPage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  let goalsCount = 0;
  if (activeOrg) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("company_entities")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", activeOrg.id)
      .eq("type", "goal");
    goalsCount = count || 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Company Goals & Outcomes</h1>
        <p className="mt-1 text-xs text-slate-400">
          Strategic outcomes, key results, and organizational targets connected to projects and tasks.
        </p>
      </div>

      {goalsCount === 0 ? (
        <EmptyState
          icon={Target}
          title="No Active Goals"
          description="Goals track company targets and OKRs across departments, directly linking execution, meetings, and decisions."
          phaseBadge="Phase 1 Planned"
        />
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-300">
          {goalsCount} goal(s) registered in Company Brain.
        </div>
      )}
    </div>
  );
}
