import { PhosphorCheckSquare, PhosphorFolder, PhosphorGitBranch, PhosphorCalendarDots } from "@/components/icons";
import { EmptyState } from "@/components/dashboard/empty-state";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { EntityPageHeader } from "@/components/dashboard/entities/entity-page-header";
import { InteractiveTaskList } from "@/components/dashboard/tasks/interactive-task-list";

export default async function TasksPage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  let tasks: Array<{
    id: string;
    title: string;
    content?: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
  }> = [];

  if (activeOrg) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("company_entities")
      .select("id, title, content, metadata, created_at, updated_at")
      .eq("organization_id", activeOrg.id)
      .eq("type", "task")
      .order("created_at", { ascending: false })
      .limit(50);
    tasks = (data as typeof tasks) || [];
  }

  const completedCount = tasks.filter(
    (t) => t.metadata?.status === "completed" || t.metadata?.completed === true
  ).length;
  const inProgressCount = tasks.filter(
    (t) => t.metadata?.status === "in_progress" || t.metadata?.status === "active"
  ).length;
  const pendingCount = tasks.length - completedCount - inProgressCount;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Interactive Page Header */}
      <EntityPageHeader
        title="Tasks & Action Items"
        description="Actionable work items originating from projects, meetings, and architectural decisions."
        entityType="task"
        createButtonText="New Task"
      />

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Tasks
            </CardTitle>
            <PhosphorCheckSquare className="h-4 w-4 text-secondary-foreground" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{tasks.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Tracked in workspace</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              In Progress
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{inProgressCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Active execution</p>
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
            <div className="text-xl font-bold text-foreground">{completedCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Finished items</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Pending
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{pendingCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">To be scheduled</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      {tasks.length > 0 ? (
        <Card className="bg-card border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Assigned Tasks ({tasks.length})
            </h2>
          </div>
          <InteractiveTaskList initialTasks={tasks} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <EmptyState
              icon={PhosphorCheckSquare}
              title="No Tasks Assigned"
              description="Action items link directly to projects, meetings, and decisions. Create your first task to start organizing execution."
              phaseBadge="Live Workspace"
              actionText="Explore in Company Map"
              actionHref="/dashboard/connections"
              className="py-12"
            />
          </div>

          <div className="space-y-4">
            <Card className="bg-card border-border p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Task Provenance & Linking
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                In KogSync, tasks are not isolated todo lists. They carry bi-directional links to:
              </p>
              <ul className="space-y-2 text-xs text-secondary-foreground">
                <li className="flex items-center gap-2">
                  <PhosphorCalendarDots className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                  <span>Action items agreed during Meetings</span>
                </li>
                <li className="flex items-center gap-2">
                  <PhosphorFolder className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  <span>Milestone deliverables under Projects</span>
                </li>
                <li className="flex items-center gap-2">
                  <PhosphorGitBranch className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>Implementation steps from Decisions</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
