import { PhosphorFolder, PhosphorTarget, PhosphorGitBranch, PhosphorUsers } from "@/components/icons";
import { EmptyState } from "@/components/dashboard/empty-state";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowUpRight, FolderGit2, CheckCircle2 } from "lucide-react";

export default async function ProjectsPage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  let projects: Array<{
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
      .eq("type", "project")
      .order("created_at", { ascending: false })
      .limit(50);
    projects = (data as typeof projects) || [];
  }

  const activeProjectsCount = projects.filter(
    (p) => p.metadata?.status !== "completed" && p.metadata?.status !== "archived"
  ).length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Projects & Initiatives
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Strategic organizational initiatives connecting milestones, teams, and decision provenance.
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
              Total Projects
            </CardTitle>
            <PhosphorFolder className="h-4 w-4 text-secondary-foreground" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{projects.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Workspace initiatives</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Active
            </CardTitle>
            <FolderGit2 className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{activeProjectsCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">In progress</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Completed
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">
              {projects.length - activeProjectsCount}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Delivered</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Milestones
            </CardTitle>
            <PhosphorTarget className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">0</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Phase 1 Target</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="p-5 bg-card border-border hover:border-hover transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <PhosphorFolder className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{project.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Created {new Date(project.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {(project.metadata?.status as string) || "Active"}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <EmptyState
              icon={PhosphorFolder}
              title="No Active Projects"
              description="Project management with milestone tracking, cross-functional ownership, and decision links will be available in Phase 1."
              phaseBadge="Phase 1 Planned"
              actionText="Explore Company Map"
              actionHref="/dashboard/connections"
              className="py-12"
            />
          </div>

          <div className="space-y-4">
            <Card className="bg-card border-border p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Initiative Architecture
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Projects structure organizational execution by bridging strategy with action items:
              </p>
              <ul className="space-y-2 text-xs text-secondary-foreground">
                <li className="flex items-center gap-2">
                  <PhosphorTarget className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Direct alignment with Company Goals</span>
                </li>
                <li className="flex items-center gap-2">
                  <PhosphorGitBranch className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>Traceability to Architectural Decisions</span>
                </li>
                <li className="flex items-center gap-2">
                  <PhosphorUsers className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span>Team collaboration and responsibility boundaries</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
