import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { getOrganizationMembersAction } from "@/lib/organizations/actions";
import { PeopleHub } from "@/components/dashboard/people/people-hub";

export default async function PeoplePage() {
  const { activeOrg } = await verifyAccessOrRedirect();

  const membersRes = activeOrg ? await getOrganizationMembersAction(activeOrg.id) : null;
  const members = membersRes?.members || [];

  return (
    <PeopleHub
      activeOrg={activeOrg}
      initialMembers={members}
      currentUserRole={activeOrg?.role || "member"}
    />
  );
}
