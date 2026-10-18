import { PhosphorCalendarDots, PhosphorCheckSquare, PhosphorGitBranch, PhosphorBrain } from "@/components/icons";
import { EmptyState } from "@/components/dashboard/empty-state";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowUpRight, Calendar, Video, Clock } from "lucide-react";

export default async function MeetingsPage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  let meetings: Array<{
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
      .eq("type", "meeting")
      .order("created_at", { ascending: false })
      .limit(50);
    meetings = (data as typeof meetings) || [];
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Meetings & Transcripts
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Meeting agendas, transcripts, attendees, summaries, and action item provenance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/calendar"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-hover hover:text-foreground transition-colors shadow-2xs"
          >
            <span>Open Calendar</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Meetings
            </CardTitle>
            <PhosphorCalendarDots className="h-4 w-4 text-secondary-foreground" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">{meetings.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Logged sessions</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Upcoming
            </CardTitle>
            <Calendar className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">0</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Scheduled</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Action Items
            </CardTitle>
            <PhosphorCheckSquare className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">0</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Linked tasks</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between pb-1.5 p-0 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              AI Summaries
            </CardTitle>
            <PhosphorBrain className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <div className="text-xl font-bold text-foreground">0</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Phase 3 Planned</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      {meetings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meetings.map((meeting) => (
            <Card key={meeting.id} className="p-5 bg-card border-border hover:border-hover transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <PhosphorCalendarDots className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{meeting.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(meeting.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  Logged
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <EmptyState
              icon={PhosphorCalendarDots}
              title="No Meetings Logged"
              description="Meeting records and action item linkage will launch in Phase 1, followed by automated AI transcription and summarization in Phase 3."
              phaseBadge="Phase 1 Planned"
              actionText="View Calendar"
              actionHref="/dashboard/calendar"
              className="py-12"
            />
          </div>

          <div className="space-y-4">
            <Card className="bg-card border-border p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Meeting Knowledge Extraction
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Meetings serve as primary knowledge generation events:
              </p>
              <ul className="space-y-2 text-xs text-secondary-foreground">
                <li className="flex items-center gap-2">
                  <PhosphorCheckSquare className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span>Automatic extraction of tasks and owners</span>
                </li>
                <li className="flex items-center gap-2">
                  <PhosphorGitBranch className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>Recording decisions made during syncs</span>
                </li>
                <li className="flex items-center gap-2">
                  <PhosphorBrain className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Durable synthesis added to company memory</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
