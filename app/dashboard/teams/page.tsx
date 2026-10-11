import { PhosphorUserList, PhosphorUsers } from "@/components/icons";
import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { getOrganizationMembersAction } from "@/lib/organizations/actions";

const DEFAULT_TEAMS = [
  { id: "eng", name: "Engineering", description: "Product architecture, infrastructure, security, and fullstack systems." },
  { id: "prod", name: "Product", description: "Feature specs, user research, roadmap milestones, and design." },
  { id: "mktg", name: "Marketing & Growth", description: "Branding, acquisition campaigns, content, and developer relations." },
  { id: "ops", name: "Operations & Finance", description: "Business administration, compliance, accounting, and legal." },
];

export default async function TeamsPage() {
  const { activeOrg } = await verifyAccessOrRedirect();
  const membersRes = activeOrg ? await getOrganizationMembersAction(activeOrg.id) : null;
  const memberCount = membersRes?.members?.length || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Company Teams</h1>
        <p className="mt-1 text-xs text-slate-400">
          Functional teams and cross-discipline groups connecting members to projects, tasks, and goals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DEFAULT_TEAMS.map((team) => (
          <div
            key={team.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <PhosphorUserList className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-semibold text-white">{team.name}</h2>
              </div>
              <span className="flex items-center gap-1 text-[11px] text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded-md border border-zinc-700/50">
                <PhosphorUsers className="h-3 w-3" />
                {memberCount} member{memberCount > 1 ? "s" : ""}
              </span>
            </div>
            <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed">
              {team.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
