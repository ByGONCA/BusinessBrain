import { redirect } from "next/navigation";
import { getActiveOrganization } from "@/lib/organizations/queries";
import {
  isGitHubConnectedAction,
  getGitHubOverviewAction,
  getGitHubRepositoriesAction,
} from "@/lib/integrations/github/actions";
import { GitHubWorkspaceHome } from "@/components/dashboard/github/github-workspace-home";
import { Github, ArrowRight, ShieldCheck, GitPullRequest, GitBranch } from "lucide-react";

export default async function GitHubPage() {
  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    redirect("/onboarding");
  }

  const isConnected = await isGitHubConnectedAction(activeOrg.id);

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center space-y-6 shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg">
            <Github className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Connect GitHub to BusinessBrain
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Link your repositories, pull requests, issues, and releases to your company knowledge base, decisions, and tasks.
            </p>
          </div>

          <div className="space-y-2.5 text-left border-y border-border py-4">
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Read-only access to repositories and metadata</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <GitPullRequest className="h-4 w-4 text-blue-500 shrink-0" />
              <span>Connect PRs & issues to projects and tasks</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <GitBranch className="h-4 w-4 text-purple-500 shrink-0" />
              <span>Internal team discussion threads without spamming GitHub</span>
            </div>
          </div>

          <a
            href="/api/integrations/github/connect"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm"
          >
            <span>Connect GitHub Workspace</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  const [overviewRes, reposRes] = await Promise.all([
    getGitHubOverviewAction(activeOrg.id),
    getGitHubRepositoriesAction(activeOrg.id),
  ]);

  return (
    <GitHubWorkspaceHome
      initialOverview={overviewRes.data}
      initialRepositories={reposRes.repositories}
      organizationId={activeOrg.id}
    />
  );
}
