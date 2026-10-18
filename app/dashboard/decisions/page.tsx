import { PhosphorGitBranch, PhosphorFolder, PhosphorTarget, PhosphorCheckSquare } from "@/components/icons";
import { EmptyState } from "@/components/dashboard/empty-state";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowUpRight, Scale, CheckCircle2 } from "lucide-react";

export default async function DecisionsPage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  let decisions: Array<{
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
      .eq("type", "decision")
      .order("created_at", { ascending: false })
      .limit(50);
    decisions = (data as typeof decisions) || [];
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Decision Registry (ADRs)
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Architecture Decision Records and strategic company choices with context, options, and rationale.
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
            <div className="text-xl font-bold text-foreground">{decisions.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Active standards</p>
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
            <div className="text-xl font-bold text-foreground">0</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Historical</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Linked Projects
            </CardTitle>
            <PhosphorFolder className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">0</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Implementation</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      {decisions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {decisions.map((decision) => (
            <Card key={decision.id} className="p-5 bg-card border-border hover:border-hover transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <PhosphorGitBranch className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{decision.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Recorded {new Date(decision.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  Accepted
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <EmptyState
              icon={PhosphorGitBranch}
              title="No Decisions Recorded"
              description="Capture context, options evaluated, and rationale for all major business and technical decisions in Phase 1."
              phaseBadge="Phase 1 Planned"
              actionText="Explore Company Map"
              actionHref="/dashboard/connections"
              className="py-12"
            />
          </div>

          <div className="space-y-4">
            <Card className="bg-card border-border p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ADR Structure & Standards
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Architecture Decision Records preserve long-term institutional memory:
              </p>
              <ul className="space-y-2 text-xs text-secondary-foreground">
                <li className="flex items-center gap-2">
                  <Scale className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>Context: Why the decision is being made</span>
                </li>
                <li className="flex items-center gap-2">
                  <PhosphorCheckSquare className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span>Decision: The selected architectural pattern</span>
                </li>
                <li className="flex items-center gap-2">
                  <PhosphorTarget className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Consequences: Trade-offs accepted by the team</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
