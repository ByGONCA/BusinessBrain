import { Brain } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function BrainPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Company Brain</h1>
        <p className="mt-1 text-xs text-slate-400">
          The conversational intelligence layer across your organization&apos;s memory.
        </p>
      </div>

      <EmptyState
        icon={Brain}
        title="AI Intelligence Layer"
        description="The AI Brain layer will be introduced in Phase 3. It will leverage Google Gemini to query your company's knowledge graph, synthesize meetings, and track decisions."
        phaseBadge="Phase 3 Planned"
      />
    </div>
  );
}
