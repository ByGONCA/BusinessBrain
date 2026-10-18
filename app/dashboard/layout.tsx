import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { getPageTree, getFavoritePagesForOrg } from "@/lib/pages/queries";
import { getOrganizationIntegrations } from "@/lib/integrations/queries";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/dashboard/sidebar-context";
import { SettingsProvider } from "@/components/dashboard/settings/settings-context";
import { LazySettingsModal } from "@/components/dashboard/settings/lazy-settings-modal";
import { InboxProvider } from "@/components/dashboard/inbox/inbox-context";
import { LazyInboxModal } from "@/components/dashboard/inbox/lazy-inbox-modal";
import { SidePeekProvider } from "@/components/dashboard/pages/side-peek-context";
import { DashboardSplitLayout } from "@/components/dashboard/dashboard-split-layout";

import { resolveUserPermissions } from "@/lib/permissions/resolver";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, organizations, activeOrg, entitlement } = await verifyAccessOrRedirect();

  const [pageTree, favoritePages, initialIntegrations, userPerms] = activeOrg
    ? await Promise.all([
        getPageTree(activeOrg.id),
        getFavoritePagesForOrg(activeOrg.id),
        getOrganizationIntegrations(activeOrg.id),
        resolveUserPermissions(user.id, activeOrg.id),
      ])
    : [[], [], [], null];

  return (
    <SidebarProvider>
      <SettingsProvider>
        <InboxProvider>
          <SidePeekProvider>
            <div className="flex h-screen overflow-hidden bg-background text-foreground selection:bg-blue-600/30 transition-colors duration-150 relative">
              {/* Floating button to reopen sidebar when collapsed */}
              <SidebarTrigger />

              {/* Sidebar - fixed and non-scrolling with page */}
              <Sidebar
                user={user}
                organizations={organizations}
                activeOrg={activeOrg}
                entitlement={entitlement}
                pageTree={pageTree}
                favoritePages={favoritePages}
                initialIntegrations={initialIntegrations}
              />

              {/* Main Content & Side Peek (Side-by-Side Split View) */}
              <DashboardSplitLayout>{children}</DashboardSplitLayout>

              {/* Notion-style Settings Modal Window (Loaded on-demand) */}
              <LazySettingsModal
                user={user}
                organizations={organizations}
                activeOrg={activeOrg}
                entitlement={entitlement}
                initialIntegrations={initialIntegrations}
                isOwner={userPerms?.isOwner ?? (activeOrg?.role === "owner")}
                userPermissions={Array.from(userPerms?.effectivePermissions || [])}
              />

              {/* Inbox Modal Window (Loaded on-demand) */}
              <LazyInboxModal />
            </div>
          </SidePeekProvider>
        </InboxProvider>
      </SettingsProvider>
    </SidebarProvider>
  );
}
