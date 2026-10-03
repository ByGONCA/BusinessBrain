import { CheckSquare } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Tasks & Action Items</h1>
        <p className="mt-1 text-xs text-slate-400">
          Actionable items originating from projects, meetings, and decisions.
        </p>
      </div>

      <EmptyState
        icon={CheckSquare}
        title="No Tasks Assigned"
        description="Task tracking, priorities, due dates, and assignments will be available in Phase 1."
        phaseBadge="Phase 1 Planned"
      />
    </div>
  );
}
