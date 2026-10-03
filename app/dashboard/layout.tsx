import { verifyAccessOrRedirect } from "@/lib/organizations/entitlements";
import { getPageTree, getFavoritePagesForOrg } from "@/lib/pages/queries";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/dashboard/sidebar-context";
import { SettingsProvider } from "@/components/dashboard/settings/settings-context";
import { SettingsModal } from "@/components/dashboard/settings/settings-modal";
import { InboxProvider } from "@/components/dashboard/inbox/inbox-context";
import { InboxModal } from "@/components/dashboard/inbox/inbox-modal";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, organizations, activeOrg, entitlement } = await verifyAccessOrRedirect();

  const [pageTree, favoritePages] = activeOrg
    ? await Promise.all([
        getPageTree(activeOrg.id),
        getFavoritePagesForOrg(activeOrg.id),
      ])
    : [[], []];

  return (
    <SidebarProvider>
      <SettingsProvider>
        <InboxProvider>
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
          />

          {/* Main Content Area - independently scrollable */}
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <main className="flex-1 overflow-y-auto no-scrollbar p-6 md:p-8">
              <div className="mx-auto max-w-7xl w-full">{children}</div>
            </main>
          </div>

          {/* Notion-style Settings Modal Window */}
          <SettingsModal
            user={user}
            organizations={organizations}
            activeOrg={activeOrg}
            entitlement={entitlement}
          />

          {/* Inbox Modal Window */}
          <InboxModal />
        </div>
      </InboxProvider>
    </SettingsProvider>
    </SidebarProvider>
  );
}
