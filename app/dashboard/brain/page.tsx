import { PhosphorBrain, PhosphorNetwork, PhosphorBookOpen, PhosphorGitBranch } from "@/components/icons";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ArrowUpRight, Sparkles, Cpu, Layers } from "lucide-react";

export default function BrainPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Company Brain
            </h1>
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
              AI Layer
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            The conversational intelligence and semantic query layer across your organization&apos;s memory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/connections"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-hover hover:text-foreground transition-colors shadow-2xs"
          >
            <span>Explore Knowledge Graph</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              LLM Engine
            </CardTitle>
            <Cpu className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">Gemini</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Phase 3 Integration</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Knowledge Graph
            </CardTitle>
            <PhosphorNetwork className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">Live</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Bi-directional links</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Memory Sources
            </CardTitle>
            <PhosphorBookOpen className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">Unified</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Pages, ADRs, Meetings</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              RAG Isolation
            </CardTitle>
            <Layers className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">RLS Guard</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Strict tenant isolation</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <EmptyState
            icon={PhosphorBrain}
            title="AI Intelligence Layer"
            description="The AI Brain layer will be introduced in Phase 3. It will leverage Google Gemini to query your company's knowledge graph, synthesize meetings, track decisions, and answer organizational queries."
            phaseBadge="Phase 3 Planned"
            actionText="Explore Connected Graph"
            actionHref="/dashboard/connections"
            className="py-12"
          />
        </div>

        <div className="space-y-4">
          <Card className="bg-card border-border p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Operating System Intelligence
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Company Brain aggregates context across the entire enterprise stack:
            </p>
            <ul className="space-y-2 text-xs text-secondary-foreground">
              <li className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span>Zero-hallucination grounded RAG queries</span>
              </li>
              <li className="flex items-center gap-2">
                <PhosphorGitBranch className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>Deep traceability back to source ADRs & pages</span>
              </li>
              <li className="flex items-center gap-2">
                <PhosphorNetwork className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Traversable relationship graph linking teams & tasks</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
