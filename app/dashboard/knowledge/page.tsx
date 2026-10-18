import { ArrowRight, ArrowUpRight, BookOpen, Layers } from "lucide-react";
import { PhosphorBookOpen, PhosphorFile, PhosphorBrain, PhosphorNetwork } from "@/components/icons";
import Link from "next/link";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function KnowledgePage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  let pageCount = 0;
  if (activeOrg) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("pages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", activeOrg.id)
      .eq("is_archived", false);
    pageCount = count || 0;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Company Knowledge
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            The durable company-context layer, operational policies, procedures, and structured facts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/pages"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-hover hover:text-foreground transition-colors shadow-2xs"
          >
            <span>Workspace Pages</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Source Documents
            </CardTitle>
            <PhosphorFile className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{pageCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Active workspace pages</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Knowledge Units
            </CardTitle>
            <PhosphorBookOpen className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{pageCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Verified company context</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Connected Graph
            </CardTitle>
            <PhosphorNetwork className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">Active</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Obsidian-style graph</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Synthesis Engine
            </CardTitle>
            <PhosphorBrain className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">Phase 3</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Gemini RAG</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 bg-card border-border hover:border-hover transition-colors">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <PhosphorBookOpen className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Durable Company Context</h2>
              <p className="text-[11px] text-muted-foreground">Policies, architecture specs, and playbooks</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            Unlike individual scratchpad notes that change frequently, Knowledge represents established truths, operational procedures, and enterprise reference materials across your business.
          </p>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Derived from workspace pages</span>
            <Link
              href="/dashboard/pages"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span>Manage Pages</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>

        <Card className="p-5 bg-card border-border hover:border-hover transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <PhosphorFile className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Document Source Layer</h2>
                <p className="text-[11px] text-muted-foreground">{pageCount} active workspace documents</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Company Knowledge derives context directly from Pages, Decision records, and meeting syntheses. Connect knowledge nodes visually in the Company Map to inspect relations.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Interactive Knowledge Graph</span>
            <Link
              href="/dashboard/connections"
              className="inline-flex items-center gap-1 text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors"
            >
              <span>Explore Graph</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
