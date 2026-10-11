import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { getOrganizationMembersAction } from "@/lib/organizations/actions";
import { resolveUserPermissions } from "@/lib/permissions/resolver";
import { getOrganizationInvitationsAction } from "@/lib/invitations/actions";
import { PeopleHub } from "@/components/dashboard/people/people-hub";

export default async function PeoplePage() {
  const { user, activeOrg } = await verifyAccessOrRedirect();

  const [membersRes, userPerms, invitesRes] = activeOrg
    ? await Promise.all([
        getOrganizationMembersAction(activeOrg.id),
        resolveUserPermissions(user.id, activeOrg.id),
        getOrganizationInvitationsAction(activeOrg.id),
      ])
    : [null, null, null];

  const members = membersRes?.members || [];
  const invitations = invitesRes?.invitations || [];
  const isOwner = userPerms?.isOwner ?? (activeOrg?.role === "owner");
  const userPermissions = Array.from(userPerms?.effectivePermissions || []);

  return (
    <PeopleHub
      activeOrg={activeOrg}
      currentUserId={user.id}
      initialMembers={members}
      initialInvitations={invitations}
      currentUserRole={activeOrg?.role || "member"}
      isOwner={isOwner}
      userPermissions={userPermissions}
    />
  );
}
