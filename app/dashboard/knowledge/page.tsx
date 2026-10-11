import { ArrowRight } from "lucide-react";
import { PhosphorBookOpen, PhosphorFile } from "@/components/icons";
import Link from "next/link";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { createClient } from "@/lib/supabase/server";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Company Knowledge</h1>
        <p className="mt-1 text-xs text-slate-400">
          The durable company-context layer, policies, procedures, and structured facts derived from company documents.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <PhosphorBookOpen className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Durable Company Context</h2>
              <p className="text-[11px] text-zinc-400">Policies, architecture specs, and playbooks</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
            Unlike individual documents that change frequently, Knowledge represents established truths, operational procedures, and enterprise reference materials.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <PhosphorFile className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Document Source Layer</h2>
                <p className="text-[11px] text-zinc-400">{pageCount} active workspace documents</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
              Company Knowledge derives context directly from Pages, Decision records, and meeting syntheses.
            </p>
          </div>

          <Link
            href="/dashboard/pages"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            Browse documentation pages
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
