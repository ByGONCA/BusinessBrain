import { PhosphorGitBranch, PhosphorFolder, PhosphorTarget, PhosphorCheckSquare } from "@/components/icons";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Scale, CheckCircle2 } from "lucide-react";
import { EntityPageHeader } from "@/components/dashboard/entities/entity-page-header";
import { EntityExplorer } from "@/components/dashboard/entities/entity-explorer";
import { CompanyEntity } from "@/lib/entities/types";

export default async function DecisionsPage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  let decisions: CompanyEntity[] = [];

  if (activeOrg) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("company_entities")
      .select("id, organization_id, type, title, content, metadata, created_by, created_at, updated_at")
      .eq("organization_id", activeOrg.id)
      .eq("type", "decision")
      .order("created_at", { ascending: false })
      .limit(100);
    decisions = (data as unknown as CompanyEntity[]) || [];
  }

  const acceptedCount = decisions.filter(
    (d) => !d.metadata?.status || d.metadata?.status === "accepted"
  ).length;
  const supersededCount = decisions.filter(
    (d) => d.metadata?.status === "superseded" || d.metadata?.status === "deprecated"
  ).length;

  return (
    <div className="space-y-6 w-full">
      {/* Interactive Page Header */}
      <EntityPageHeader
        title="Decision Registry (ADRs)"
        description="Architecture Decision Records and strategic company choices with context, options, and rationale."
        entityType="decision"
        createButtonText="New Decision"
      />

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Decisions
            </CardTitle>
            <PhosphorGitBranch className="h-4 w-4 text-secondary-foreground" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{decisions.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Recorded ADRs</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Accepted
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{acceptedCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Active architecture</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Superseded
            </CardTitle>
            <Scale className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{supersededCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Historical context</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Brain Graph
            </CardTitle>
            <PhosphorGitBranch className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">Active</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Visible in Graph</p>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Entity Explorer */}
      <EntityExplorer
        initialEntities={decisions}
        entityType="decision"
        title="Decisions"
        createButtonText="New Decision"
        icon={PhosphorGitBranch}
      />
    </div>
  );
}
