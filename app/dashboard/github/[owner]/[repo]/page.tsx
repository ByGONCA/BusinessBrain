import { notFound, redirect } from "next/navigation";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { getGitHubRepositoryDetailsAction } from "@/lib/integrations/github/actions";
import { RepositoryDetailView } from "@/components/dashboard/github/repository-detail-view";

interface RepositoryPageProps {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

export default async function RepositoryPage({ params }: RepositoryPageProps) {
  const { owner, repo } = await params;
  const activeOrg = await getActiveOrganization();

  if (!activeOrg) {
    redirect("/onboarding");
  }

  const res = await getGitHubRepositoryDetailsAction(owner, repo, activeOrg.id);

  if (!res.success || !res.repository) {
    notFound();
  }

  return (
    <RepositoryDetailView
      repository={res.repository}
      organizationId={activeOrg.id}
    />
  );
}
