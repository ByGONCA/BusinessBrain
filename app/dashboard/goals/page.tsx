import { PhosphorTarget, PhosphorCheckSquare, PhosphorFolder, PhosphorGitBranch } from "@/components/icons";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Target, CheckCircle2 } from "lucide-react";
import { EntityPageHeader } from "@/components/dashboard/entities/entity-page-header";
import { EntityExplorer } from "@/components/dashboard/entities/entity-explorer";
import { CompanyEntity } from "@/lib/entities/types";

export default async function GoalsPage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  let goals: CompanyEntity[] = [];

  if (activeOrg) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("company_entities")
      .select("id, organization_id, type, title, content, metadata, created_by, created_at, updated_at")
      .eq("organization_id", activeOrg.id)
      .eq("type", "goal")
      .order("created_at", { ascending: false })
      .limit(100);
    goals = (data as unknown as CompanyEntity[]) || [];
  }

  const onTrackCount = goals.filter(
    (g) => g.metadata?.status === "active" || g.metadata?.status === "achieved" || !g.metadata?.status
  ).length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Interactive Page Header */}
      <EntityPageHeader
        title="Company Goals & Outcomes"
        description="Strategic outcomes, OKRs, and organizational targets connected to projects and tasks."
        entityType="goal"
        createButtonText="New Goal"
      />

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Goals
            </CardTitle>
            <PhosphorTarget className="h-4 w-4 text-secondary-foreground" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{goals.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Strategic targets</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              On Track
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{onTrackCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Healthy progress</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Connected Projects
            </CardTitle>
            <PhosphorFolder className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">Active</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Cross-linked in Graph</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Key Results
            </CardTitle>
            <Target className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{goals.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Measurable metrics</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Interactive Entity Explorer with Search, Filters, Sorting and Edit Modal */}
      <EntityExplorer
        initialEntities={goals}
        entityType="goal"
        title="Goals"
        createButtonText="New Goal"
        icon={PhosphorTarget}
      />
    </div>
  );
}
