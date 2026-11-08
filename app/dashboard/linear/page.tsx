import { redirect } from "next/navigation";
import Image from "next/image";
import { getActiveOrganization } from "@/lib/organizations/queries";
import {
  isLinearConnectedAction,
  getLinearIntelligenceSnapshotAction,
} from "@/lib/integrations/linear/actions";
import { LinearIntegrationView } from "@/components/dashboard/linear/linear-integration-view";
import { ShieldCheck, ArrowRight, AlertTriangle, Sparkles, Layers, Activity } from "lucide-react";

export default async function LinearIntegrationPage() {
  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    redirect("/onboarding");
  }

  const isConnected = await isLinearConnectedAction(activeOrg.id);

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center space-y-6 shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 dark:bg-white/10 text-white shadow-lg border border-white/10">
            <Image
              src="/Logos/linear-icon.svg"
              alt="Linear"
              width={36}
              height={36}
              className="object-contain"
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Connect Linear to KogSync
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enable Linear as an external data provider for the KogSync Intelligence Engine. Stream real-time sprint velocity, project milestones, and cycle progress directly into your company knowledge base.
            </p>
          </div>

          <div className="space-y-2.5 text-left border-y border-border py-4">
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Read-only OAuth access (`read` scope)</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />
              <span>Normalized data ingestion for KogSync AI models</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <Layers className="h-4 w-4 text-purple-500 shrink-0" />
              <span>Zero database replication: zero storage bloat</span>
            </div>
          </div>

          <a
            href={`/api/integrations/linear/connect?returnUrl=${encodeURIComponent("/dashboard/linear")}`}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm"
          >
            <span>Connect Linear Workspace</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  const snapshotRes = await getLinearIntelligenceSnapshotAction(activeOrg.id);

  if (snapshotRes.authExpired) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-card p-8 text-center space-y-6 shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 shadow-lg border border-amber-500/20">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Linear Session Expired
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your Linear OAuth authorization token was rotated or expired. Re-authenticate to resume streaming issues, projects, and sprint velocity into the Intelligence Engine.
            </p>
          </div>

          <a
            href={`/api/integrations/linear/connect?returnUrl=${encodeURIComponent("/dashboard/linear")}`}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-500 transition-colors shadow-sm"
          >
            <span>Reconnect Linear</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  if (!snapshotRes.success || !snapshotRes.data) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-card p-8 text-center space-y-4 shadow-xl">
          <h2 className="text-base font-bold text-foreground">Failed to Load Linear Provider</h2>
          <p className="text-xs text-muted-foreground">
            {snapshotRes.error || "Unable to retrieve Linear workspace data. Please verify your connection."}
          </p>
          <a
            href="/dashboard/linear"
            className="inline-block rounded-xl bg-muted px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/80"
          >
            Retry
          </a>
        </div>
      </div>
    );
  }

  return (
    <LinearIntegrationView
      initialSnapshot={snapshotRes.data}
      organizationId={activeOrg.id}
    />
  );
}
