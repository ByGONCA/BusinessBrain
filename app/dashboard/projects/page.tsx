import { PhosphorFolder, PhosphorTarget, PhosphorGitBranch, PhosphorUsers } from "@/components/icons";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FolderGit2, CheckCircle2 } from "lucide-react";
import { EntityPageHeader } from "@/components/dashboard/entities/entity-page-header";
import { EntityExplorer } from "@/components/dashboard/entities/entity-explorer";
import { CompanyEntity } from "@/lib/entities/types";

export default async function ProjectsPage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  let projects: CompanyEntity[] = [];

  if (activeOrg) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("company_entities")
      .select("id, organization_id, type, title, content, metadata, created_by, created_at, updated_at")
      .eq("organization_id", activeOrg.id)
      .eq("type", "project")
      .order("created_at", { ascending: false })
      .limit(100);
    projects = (data as unknown as CompanyEntity[]) || [];
  }

  const activeProjectsCount = projects.filter(
    (p) => p.metadata?.status !== "completed" && p.metadata?.status !== "archived"
  ).length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Interactive Page Header */}
      <EntityPageHeader
        title="Projects & Initiatives"
        description="Strategic organizational initiatives connecting milestones, teams, and decision provenance."
        entityType="project"
        createButtonText="New Project"
      />

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
            <p className="text-[10px] text-muted-foreground mt-0.5">In flight</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Connected Outcomes
            </CardTitle>
            <PhosphorTarget className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{projects.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Linked to Goals</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Decision Logs
            </CardTitle>
            <PhosphorGitBranch className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">Active</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Tracked in Graph</p>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Entity Explorer */}
      <EntityExplorer
        initialEntities={projects}
        entityType="project"
        title="Projects"
        createButtonText="New Project"
        icon={PhosphorFolder}
      />
    </div>
  );
}
