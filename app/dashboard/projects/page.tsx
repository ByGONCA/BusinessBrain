import { PhosphorFolder } from "@/components/icons";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Projects</h1>
        <p className="mt-1 text-xs text-slate-400">
          Strategic initiatives connected directly to company decisions.
        </p>
      </div>

      <EmptyState
        icon={PhosphorFolder}
        title="No Active Projects"
        description="Project management with milestone tracking, ownership, and decision links will be available in Phase 1."
        phaseBadge="Phase 1 Planned"
      />
    </div>
  );
}
