import { getActiveOrganization } from "@/lib/organizations/queries";
import { getCompanyTimelineEvents } from "@/lib/timeline/queries";
import { CompanyTimeline } from "@/components/dashboard/timeline/company-timeline";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  GitBranch,
  BookOpen,
  Users,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

export default async function DashboardOverviewPage() {
  const activeOrg = await getActiveOrganization();
  const timelineEvents = activeOrg ? await getCompanyTimelineEvents(activeOrg.id) : [];

  return (
    <div className="space-y-8">
      {/* Overview Header */}
      <div className="flex flex-col gap-1 pb-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Overview
          </h1>
          {activeOrg && (
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {activeOrg.name}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Visão geral do projeto e contexto unificado do workspace.
        </p>
      </div>

      {/* Company Timeline */}
      {activeOrg && (
        <CompanyTimeline
          events={timelineEvents}
          organizationName={activeOrg.name}
        />
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">
              Decisions
            </CardTitle>
            <GitBranch className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">0</div>
            <p className="mt-1 text-[11px] text-slate-500">
              ADRs & strategic choices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">
              Projects
            </CardTitle>
            <FolderKanban className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">0</div>
            <p className="mt-1 text-[11px] text-slate-500">
              Active initiatives
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">
              Knowledge
            </CardTitle>
            <BookOpen className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">0</div>
            <p className="mt-1 text-[11px] text-slate-500">
              Wikis & SOP documents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">
              Team Members
            </CardTitle>
            <Users className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">1</div>
            <p className="mt-1 text-[11px] text-slate-500">
              Active workspace users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Next Steps & Foundation Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Workspace Modules</CardTitle>
            <CardDescription>
              Explore the core components of the Company Brain operating system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { title: "Knowledge Base", href: "/dashboard/knowledge", desc: "Wikis, specs, and documents." },
              { title: "Decision Registry", href: "/dashboard/decisions", desc: "Capture why key decisions were made." },
              { title: "Projects & Tasks", href: "/dashboard/projects", desc: "Track strategic execution." },
              { title: "Meetings", href: "/dashboard/meetings", desc: "Meeting notes and summaries." },
            ].map((module) => (
              <Link
                key={module.title}
                href={module.href}
                prefetch={true}
                className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/40 p-3 hover:border-slate-700 transition-colors group"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                    {module.title}
                  </p>
                  <p className="text-[11px] text-slate-400">{module.desc}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Architecture Status</CardTitle>
              <Badge variant="secondary">Phase 0</Badge>
            </div>
            <CardDescription>
              Current state of the Company Brain operating system foundation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-start gap-2.5 rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">PostgreSQL Tenant Isolation</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Row Level Security policies enforce strict organization-level data boundaries.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
              <Sparkles className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">Decoupled AI & Stripe Modules</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Gemini and Stripe services are isolated in <code className="text-blue-300">lib/</code>, ready for Phase 1 & Phase 3.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
