import { Users } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function MeetingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Meetings & Transcripts</h1>
        <p className="mt-1 text-xs text-slate-400">
          Meeting agendas, attendees, summaries, and action item provenance.
        </p>
      </div>

      <EmptyState
        icon={Users}
        title="No Meetings Logged"
        description="Meeting records and action item linkage will launch in Phase 1, followed by automated AI transcription in Phase 3."
        phaseBadge="Phase 1 Planned"
      />
    </div>
  );
}
