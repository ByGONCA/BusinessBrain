import { Activity, ShieldCheck, GitBranch, FolderKanban, Users, Clock } from "lucide-react";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { getCompanyTimelineEvents } from "@/lib/timeline/queries";

export default async function ActivityPage() {
  const { activeOrg } = await verifyAccessOrRedirect();
  const timelineEvents = activeOrg ? await getCompanyTimelineEvents(activeOrg.id) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Company Activity</h1>
        <p className="mt-1 text-xs text-slate-400">
          Meaningful high-level organizational updates across projects, decisions, integrations, and workspace events.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 divide-y divide-zinc-800/80">
        {timelineEvents.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">
            No company activities recorded yet.
          </div>
        ) : (
          timelineEvents.map((evt) => (
            <div key={evt.id} className="py-3.5 first:pt-1 last:pb-1 flex items-start gap-3">
              <div className="h-7 w-7 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                {evt.category === "milestone" ? (
                  <GitBranch className="h-3.5 w-3.5" />
                ) : evt.category === "team" ? (
                  <Users className="h-3.5 w-3.5" />
                ) : (
                  <Activity className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-zinc-200 truncate">{evt.title}</p>
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(evt.timestamp).toLocaleDateString()}
                  </span>
                </div>
                {evt.description && (
                  <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{evt.description}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
