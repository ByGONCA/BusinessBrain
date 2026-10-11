import { PhosphorGitBranch } from "@/components/icons";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function DecisionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Decision Registry</h1>
        <p className="mt-1 text-xs text-slate-400">
          Architecture Decision Records (ADRs) and strategic company choices.
        </p>
      </div>

      <EmptyState
        icon={PhosphorGitBranch}
        title="No Decisions Recorded"
        description="Capture context, options evaluated, and rationale for all major business and technical decisions in Phase 1."
        phaseBadge="Phase 1 Planned"
      />
    </div>
  );
}
