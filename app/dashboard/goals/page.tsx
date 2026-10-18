import { PhosphorTarget, PhosphorCheckSquare, PhosphorFolder, PhosphorGitBranch } from "@/components/icons";
import { EmptyState } from "@/components/dashboard/empty-state";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowUpRight, Target, CheckCircle2 } from "lucide-react";

export default async function GoalsPage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  let goals: Array<{
    id: string;
    title: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
  }> = [];

  if (activeOrg) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("company_entities")
      .select("id, title, metadata, created_at, updated_at")
      .eq("organization_id", activeOrg.id)
      .eq("type", "goal")
      .order("created_at", { ascending: false })
      .limit(50);
    goals = (data as typeof goals) || [];
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Company Goals & Outcomes
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Strategic outcomes, OKRs, and organizational targets connected to projects and tasks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/connections"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-hover hover:text-foreground transition-colors shadow-2xs"
          >
            <span>View in Graph</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </div>
      </div>

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
            <div className="text-xl font-bold text-foreground">{goals.length}</div>
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
            <div className="text-xl font-bold text-foreground">0</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Phase 1 Target</p>
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
            <div className="text-xl font-bold text-foreground">0</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Metrics linked</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      {goals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal) => (
            <Card key={goal.id} className="p-5 bg-card border-border hover:border-hover transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <PhosphorTarget className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{goal.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Target deadline: {(goal.metadata?.target_date as string) || "Quarterly"}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {(goal.metadata?.status as string) || "Active"}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <EmptyState
              icon={PhosphorTarget}
              title="No Active Goals"
              description="Goals track company targets and OKRs across departments, directly linking execution, meetings, and architectural decisions."
              phaseBadge="Phase 1 Planned"
              actionText="Explore Company Map"
              actionHref="/dashboard/connections"
              className="py-12"
            />
          </div>

          <div className="space-y-4">
            <Card className="bg-card border-border p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Outcome Architecture
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Goals define the north star objectives of your business:
              </p>
              <ul className="space-y-2 text-xs text-secondary-foreground">
                <li className="flex items-center gap-2">
                  <PhosphorCheckSquare className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span>Execution breakdowns into measurable Tasks</span>
                </li>
                <li className="flex items-center gap-2">
                  <PhosphorFolder className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  <span>Multi-month initiatives organized under Projects</span>
                </li>
                <li className="flex items-center gap-2">
                  <PhosphorGitBranch className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>Alignment with ADR rationale and strategic trade-offs</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
