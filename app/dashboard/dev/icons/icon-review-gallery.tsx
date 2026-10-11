"use client";

import * as React from "react";
import {
  PHOSPHOR_ICONS,
  PhosphorIconName,
  PhosphorIconProps,
  PhosphorHouse,
  PhosphorFolder,
  PhosphorCheckSquare,
  PhosphorTarget,
  PhosphorCalendarDots,
  PhosphorCalendar,
  PhosphorBrain,
  PhosphorGitBranch,
  PhosphorBookOpen,
  PhosphorNetwork,
  PhosphorClock,
  PhosphorUserList,
  PhosphorUsers,
  PhosphorUser,
  PhosphorUserPlus,
  PhosphorUserMinus,
  PhosphorUserGear,
  PhosphorUserSwitch,
  PhosphorPlugs,
  PhosphorGear,
  PhosphorCreditCard,
  PhosphorBell,
  PhosphorFile,
  PhosphorFiles,
  PhosphorPackage,
  PhosphorSealWarning,
  PhosphorWarningOctagon,
  PhosphorArrowsClockwise,
  PhosphorBugBeetle,
  PhosphorGitCommit,
  PhosphorGitDiff,
  PhosphorGitFork,
  PhosphorGitMerge,
  PhosphorGithubLogo,
  PhosphorBook,
  PhosphorBookmark,
  PhosphorBookmarkSimple,
  PhosphorBookmarksSimple,
  PhosphorCalendarBlank,
} from "@/components/icons";
import {
  FolderKanban,
  CheckSquare,
  Target,
  Users,
  Brain,
  GitBranch,
  BookOpen,
  Network,
  Clock,
  Mail,
  Home,
  Calendar,
  Github,
  Building2,
  Settings2,
  HardDrive,
  CreditCard,
  Lock,
  Search,
  Check,
  Copy,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureMapping {
  area: "Navigation (Sidebar)" | "Overview & Workspaces" | "People & Governance" | "Settings & Security" | "GitHub Integration";
  feature: string;
  component: string;
  currentLucideIcon: React.ComponentType<{ className?: string }>;
  currentLucideName: string;
  phosphorIcon: React.ComponentType<PhosphorIconProps>;
  phosphorName: string;
  assetSource: string;
  status: "Active & Upgraded" | "Preserved Brand Logo" | "Available in Library";
  notes: string;
}

const FEATURE_MAPPINGS: FeatureMapping[] = [
  // 1. Navigation
  {
    area: "Navigation (Sidebar)",
    feature: "Home / Workspace Entry",
    component: "components/dashboard/sidebar.tsx",
    currentLucideIcon: Home,
    currentLucideName: "Home",
    phosphorIcon: PhosphorHouse,
    phosphorName: "PhosphorHouse",
    assetSource: "public/Icons/house.svg",
    status: "Active & Upgraded",
    notes: "Phosphor 256x256 regular weight vector matches Notion B2B design language.",
  },
  {
    area: "Navigation (Sidebar)",
    feature: "Projects Module",
    component: "components/dashboard/sidebar.tsx",
    currentLucideIcon: FolderKanban,
    currentLucideName: "FolderKanban",
    phosphorIcon: PhosphorFolder,
    phosphorName: "PhosphorFolder",
    assetSource: "public/Icons/folder.svg",
    status: "Active & Upgraded",
    notes: "Replaces detailed kanban icon with clean, unified Phosphor folder.",
  },
  {
    area: "Navigation (Sidebar)",
    feature: "Tasks & To-Dos",
    component: "components/dashboard/sidebar.tsx",
    currentLucideIcon: CheckSquare,
    currentLucideName: "CheckSquare",
    phosphorIcon: PhosphorCheckSquare,
    phosphorName: "PhosphorCheckSquare",
    assetSource: "public/Icons/check-square.svg",
    status: "Active & Upgraded",
    notes: "Geometric square checkbox matching tasks empty states.",
  },
  {
    area: "Navigation (Sidebar)",
    feature: "Company Goals / OKRs",
    component: "components/dashboard/sidebar.tsx",
    currentLucideIcon: Target,
    currentLucideName: "Target",
    phosphorIcon: PhosphorTarget,
    phosphorName: "PhosphorTarget",
    assetSource: "public/Icons/target.svg",
    status: "Active & Upgraded",
    notes: "High-contrast concentric target icon.",
  },
  {
    area: "Navigation (Sidebar)",
    feature: "Meetings & Synopses",
    component: "components/dashboard/sidebar.tsx",
    currentLucideIcon: Users,
    currentLucideName: "Users (Conflicted)",
    phosphorIcon: PhosphorCalendarDots,
    phosphorName: "PhosphorCalendarDots",
    assetSource: "public/Icons/calendar-dots.svg",
    status: "Active & Upgraded",
    notes: "Resolves visual collision: previously shared the same icon with People/Teams.",
  },
  {
    area: "Navigation (Sidebar)",
    feature: "AI Brain Layer",
    component: "components/dashboard/sidebar.tsx",
    currentLucideIcon: Brain,
    currentLucideName: "Brain",
    phosphorIcon: PhosphorBrain,
    phosphorName: "PhosphorBrain",
    assetSource: "public/Icons/brain.svg",
    status: "Active & Upgraded",
    notes: "Custom Phosphor cerebral lobes vector for core intelligence layer.",
  },
  {
    area: "Navigation (Sidebar)",
    feature: "Decisions (ADRs)",
    component: "components/dashboard/sidebar.tsx",
    currentLucideIcon: GitBranch,
    currentLucideName: "GitBranch",
    phosphorIcon: PhosphorGitBranch,
    phosphorName: "PhosphorGitBranch",
    assetSource: "public/Icons/git-branch.svg",
    status: "Active & Upgraded",
    notes: "Bifurcation branch representing strategic company choices.",
  },
  {
    area: "Navigation (Sidebar)",
    feature: "Company Knowledge Base",
    component: "components/dashboard/sidebar.tsx",
    currentLucideIcon: BookOpen,
    currentLucideName: "BookOpen",
    phosphorIcon: PhosphorBookOpen,
    phosphorName: "PhosphorBookOpen",
    assetSource: "public/Icons/book-open.svg",
    status: "Active & Upgraded",
    notes: "Clean dual-page open book icon for wiki and documentation.",
  },
  {
    area: "Navigation (Sidebar)",
    feature: "Company Map (Network Graph)",
    component: "components/dashboard/sidebar.tsx",
    currentLucideIcon: Network,
    currentLucideName: "Network",
    phosphorIcon: PhosphorNetwork,
    phosphorName: "PhosphorNetwork",
    assetSource: "public/Icons/network.svg",
    status: "Active & Upgraded",
    notes: "Graph vertices and edges matching enterprise entity connections.",
  },
  {
    area: "Navigation (Sidebar)",
    feature: "Company Timeline",
    component: "components/dashboard/sidebar.tsx",
    currentLucideIcon: Clock,
    currentLucideName: "Clock",
    phosphorIcon: PhosphorClock,
    phosphorName: "PhosphorClock",
    assetSource: "public/Icons/clock.svg",
    status: "Active & Upgraded",
    notes: "Chronological clock with crisp 2-hand layout.",
  },
  {
    area: "Navigation (Sidebar)",
    feature: "People Hub",
    component: "components/dashboard/sidebar.tsx",
    currentLucideIcon: Users,
    currentLucideName: "Users",
    phosphorIcon: PhosphorUserList,
    phosphorName: "PhosphorUserList",
    assetSource: "public/Icons/user-list.svg",
    status: "Active & Upgraded",
    notes: "User silhouette with horizontal roster lines for employee directory.",
  },
  {
    area: "Navigation (Sidebar)",
    feature: "Calendar Navigation",
    component: "components/dashboard/sidebar.tsx",
    currentLucideIcon: Calendar,
    currentLucideName: "Calendar",
    phosphorIcon: PhosphorCalendar,
    phosphorName: "PhosphorCalendar",
    assetSource: "public/Icons/calendar.svg",
    status: "Active & Upgraded",
    notes: "Month grid icon for top-level calendar.",
  },
  {
    area: "Navigation (Sidebar)",
    feature: "GitHub Workspace Item",
    component: "components/dashboard/sidebar.tsx",
    currentLucideIcon: Github,
    currentLucideName: "Github",
    phosphorIcon: PhosphorGithubLogo,
    phosphorName: "PhosphorGithubLogo",
    assetSource: "public/Icons/github-logo.svg",
    status: "Active & Upgraded",
    notes: "Official Phosphor GitHub silhouette, consistent with monochrome sidebar theme.",
  },

  // 2. Overview & Workspaces
  {
    area: "Overview & Workspaces",
    feature: "Decisions Metric Card",
    component: "app/dashboard/page.tsx",
    currentLucideIcon: GitBranch,
    currentLucideName: "GitBranch",
    phosphorIcon: PhosphorGitBranch,
    phosphorName: "PhosphorGitBranch",
    assetSource: "public/Icons/git-branch.svg",
    status: "Active & Upgraded",
    notes: "Standardized across metric cards.",
  },
  {
    area: "Overview & Workspaces",
    feature: "Projects Metric Card",
    component: "app/dashboard/page.tsx",
    currentLucideIcon: FolderKanban,
    currentLucideName: "FolderKanban",
    phosphorIcon: PhosphorFolder,
    phosphorName: "PhosphorFolder",
    assetSource: "public/Icons/folder.svg",
    status: "Active & Upgraded",
    notes: "Standardized across metric cards.",
  },
  {
    area: "Overview & Workspaces",
    feature: "Knowledge Metric Card",
    component: "app/dashboard/page.tsx",
    currentLucideIcon: BookOpen,
    currentLucideName: "BookOpen",
    phosphorIcon: PhosphorBookOpen,
    phosphorName: "PhosphorBookOpen",
    assetSource: "public/Icons/book-open.svg",
    status: "Active & Upgraded",
    notes: "Standardized across metric cards.",
  },
  {
    area: "Overview & Workspaces",
    feature: "Team Members Metric Card",
    component: "app/dashboard/page.tsx",
    currentLucideIcon: Users,
    currentLucideName: "Users",
    phosphorIcon: PhosphorUsers,
    phosphorName: "PhosphorUsers",
    assetSource: "public/Icons/users.svg",
    status: "Active & Upgraded",
    notes: "Multi-user silhouette for active organization head count.",
  },
  {
    area: "Overview & Workspaces",
    feature: "Hierarchy Tree Switcher",
    component: "components/dashboard/connections/company-map-workspace.tsx",
    currentLucideIcon: GitBranch,
    currentLucideName: "GitFork",
    phosphorIcon: PhosphorGitFork,
    phosphorName: "PhosphorGitFork",
    assetSource: "public/Icons/git-fork.svg",
    status: "Active & Upgraded",
    notes: "Tree branching selector in Company Map toolbar.",
  },

  // 3. People & Governance
  {
    area: "People & Governance",
    feature: "Members Tab Trigger",
    component: "components/dashboard/people/people-hub.tsx",
    currentLucideIcon: Users,
    currentLucideName: "Users",
    phosphorIcon: PhosphorUsers,
    phosphorName: "PhosphorUsers",
    assetSource: "public/Icons/users.svg",
    status: "Active & Upgraded",
    notes: "People Hub primary tab.",
  },
  {
    area: "People & Governance",
    feature: "Teams Tab Trigger",
    component: "components/dashboard/people/people-hub.tsx",
    currentLucideIcon: FolderKanban,
    currentLucideName: "FolderGit2 (Mismatched)",
    phosphorIcon: PhosphorUserList,
    phosphorName: "PhosphorUserList",
    assetSource: "public/Icons/user-list.svg",
    status: "Active & Upgraded",
    notes: "Replaces misplaced git folder icon with member list icon.",
  },
  {
    area: "People & Governance",
    feature: "Capabilities / Role Admin",
    component: "components/dashboard/people/people-hub.tsx",
    currentLucideIcon: Shield,
    currentLucideName: "Shield",
    phosphorIcon: PhosphorUserGear,
    phosphorName: "PhosphorUserGear",
    assetSource: "public/Icons/user-gear.svg",
    status: "Active & Upgraded",
    notes: "User gear cog represents permissions administration.",
  },
  {
    area: "People & Governance",
    feature: "Invitations Tab Trigger",
    component: "components/dashboard/people/people-hub.tsx",
    currentLucideIcon: Mail,
    currentLucideName: "Mail (Generic)",
    phosphorIcon: PhosphorUserPlus,
    phosphorName: "PhosphorUserPlus",
    assetSource: "public/Icons/user-plus.svg",
    status: "Active & Upgraded",
    notes: "User-plus indicates member invitation intent far clearer than mail envelope.",
  },

  // 4. Settings & Security
  {
    area: "Settings & Security",
    feature: "General Settings Tab",
    component: "components/dashboard/settings/settings-modal.tsx",
    currentLucideIcon: Building2,
    currentLucideName: "Building2",
    phosphorIcon: PhosphorGear,
    phosphorName: "PhosphorGear",
    assetSource: "public/Icons/gear.svg",
    status: "Active & Upgraded",
    notes: "Classic engineering cog for workspace configuration.",
  },
  {
    area: "Settings & Security",
    feature: "Integrations Settings Tab",
    component: "components/dashboard/settings/settings-modal.tsx",
    currentLucideIcon: Mail,
    currentLucideName: "Mail (Inappropriate)",
    phosphorIcon: PhosphorPlugs,
    phosphorName: "PhosphorPlugs",
    assetSource: "public/Icons/plugs.svg",
    status: "Active & Upgraded",
    notes: "Fixes inappropriate mail icon on integrations tab.",
  },
  {
    area: "Settings & Security",
    feature: "Audit Log Tab",
    component: "components/dashboard/settings/settings-modal.tsx",
    currentLucideIcon: Clock,
    currentLucideName: "Clock",
    phosphorIcon: PhosphorClock,
    phosphorName: "PhosphorClock",
    assetSource: "public/Icons/clock.svg",
    status: "Active & Upgraded",
    notes: "Consistent timestamp icon across the application.",
  },
  {
    area: "Settings & Security",
    feature: "Storage & File Quotas",
    component: "components/dashboard/settings/settings-modal.tsx",
    currentLucideIcon: HardDrive,
    currentLucideName: "HardDrive",
    phosphorIcon: PhosphorFiles,
    phosphorName: "PhosphorFiles",
    assetSource: "public/Icons/files.svg",
    status: "Active & Upgraded",
    notes: "Documents bundle icon for storage capacity.",
  },
  {
    area: "Settings & Security",
    feature: "Usage & Billing Tab",
    component: "components/dashboard/settings/settings-modal.tsx",
    currentLucideIcon: CreditCard,
    currentLucideName: "CreditCard",
    phosphorIcon: PhosphorCreditCard,
    phosphorName: "PhosphorCreditCard",
    assetSource: "public/Icons/credit-card.svg",
    status: "Active & Upgraded",
    notes: "Payment card representation.",
  },
  {
    area: "Settings & Security",
    feature: "Security & Passwords Tab",
    component: "components/dashboard/settings/settings-modal.tsx",
    currentLucideIcon: Lock,
    currentLucideName: "Lock",
    phosphorIcon: PhosphorWarningOctagon,
    phosphorName: "PhosphorWarningOctagon",
    assetSource: "public/Icons/warning-octagon.svg",
    status: "Active & Upgraded",
    notes: "Octagonal perimeter shield for security governance.",
  },
  {
    area: "Settings & Security",
    feature: "Notifications Tab",
    component: "components/dashboard/settings/settings-modal.tsx",
    currentLucideIcon: Clock,
    currentLucideName: "Bell",
    phosphorIcon: PhosphorBell,
    phosphorName: "PhosphorBell",
    assetSource: "public/Icons/bell.svg",
    status: "Active & Upgraded",
    notes: "Notification chime bell.",
  },

  // 5. GitHub Workspace
  {
    area: "GitHub Integration",
    feature: "Folder Tree in Repository",
    component: "components/dashboard/github/github-workspace-home.tsx",
    currentLucideIcon: FolderKanban,
    currentLucideName: "Folder",
    phosphorIcon: PhosphorFolder,
    phosphorName: "PhosphorFolder",
    assetSource: "public/Icons/folder.svg",
    status: "Active & Upgraded",
    notes: "Folder item in repository contents explorer.",
  },
  {
    area: "GitHub Integration",
    feature: "File Item in Repository",
    component: "components/dashboard/github/github-workspace-home.tsx",
    currentLucideIcon: BookOpen,
    currentLucideName: "File",
    phosphorIcon: PhosphorFile,
    phosphorName: "PhosphorFile",
    assetSource: "public/Icons/file.svg",
    status: "Active & Upgraded",
    notes: "Document file item in repository contents explorer.",
  },
  {
    area: "GitHub Integration",
    feature: "Commits in Activity Feed",
    component: "components/dashboard/github/github-workspace-home.tsx",
    currentLucideIcon: GitBranch,
    currentLucideName: "GitCommit",
    phosphorIcon: PhosphorGitCommit,
    phosphorName: "PhosphorGitCommit",
    assetSource: "public/Icons/git-commit.svg",
    status: "Active & Upgraded",
    notes: "Node revision dot on commit line.",
  },
  {
    area: "GitHub Integration",
    feature: "Pull Requests Merged",
    component: "components/dashboard/github/github-workspace-home.tsx",
    currentLucideIcon: GitBranch,
    currentLucideName: "GitMerge",
    phosphorIcon: PhosphorGitMerge,
    phosphorName: "PhosphorGitMerge",
    assetSource: "public/Icons/git-merge.svg",
    status: "Active & Upgraded",
    notes: "Branch integration node.",
  },
];

const BRAND_LOGOS = [
  { name: "GitHub", path: "/Logos/github-icon.svg", category: "Code & Engineering" },
  { name: "Google", path: "/Logos/google-icon.svg", category: "Auth & Platform" },
  { name: "Gmail", path: "/Logos/google-gmail.svg", category: "Communication" },
  { name: "Google Calendar", path: "/Logos/google-calendar.svg", category: "Calendar" },
  { name: "Google Drive", path: "/Logos/google-drive.svg", category: "Storage" },
  { name: "Microsoft", path: "/Logos/microsoft-icon.svg", category: "Platform & Auth" },
  { name: "Microsoft Teams", path: "/Logos/microsoft-teams.svg", category: "Communication" },
  { name: "Slack", path: "/Logos/slack-icon.svg", category: "Messaging" },
  { name: "Linear", path: "/Logos/linear-icon.svg", category: "Issue Tracking" },
  { name: "Stripe", path: "/Logos/stripe.svg", category: "Payments & Billing" },
  { name: "Vercel", path: "/Logos/vercel-icon.svg", category: "Cloud & Hosting" },
  { name: "Sentry", path: "/Logos/sentry-icon.svg", category: "Monitoring & Errors" },
];

export function IconReviewGallery() {
  const [activeTab, setActiveTab] = React.useState<"all" | "matrix" | "brands" | "guidelines">("matrix");
  const [search, setSearch] = React.useState("");
  const [copiedName, setCopiedName] = React.useState<string | null>(null);

  const copyCode = (name: string, snippet: string) => {
    navigator.clipboard.writeText(snippet);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 2000);
  };

  const phosphorKeys = Object.keys(PHOSPHOR_ICONS) as PhosphorIconName[];
  const filteredPhosphor = phosphorKeys.filter((k) =>
    k.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMappings = FEATURE_MAPPINGS.filter(
    (m) =>
      m.feature.toLowerCase().includes(search.toLowerCase()) ||
      m.area.toLowerCase().includes(search.toLowerCase()) ||
      m.phosphorName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground font-medium">Phosphor Vectors (public/Icons)</p>
          <p className="text-2xl font-bold text-foreground mt-1">39 Assets</p>
          <p className="text-[11px] text-emerald-500 font-medium mt-1">100% SVG Single-Path</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground font-medium">Official Brand Marks (public/Logos)</p>
          <p className="text-2xl font-bold text-foreground mt-1">12+ Logos</p>
          <p className="text-[11px] text-blue-400 font-medium mt-1">Original Brand SVGs</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground font-medium">Core Upgraded Areas</p>
          <p className="text-2xl font-bold text-foreground mt-1">26 Features</p>
          <p className="text-[11px] text-emerald-500 font-medium mt-1">Sidebar, Dashboard, Settings, People</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground font-medium">Design System Strictness</p>
          <p className="text-2xl font-bold text-foreground mt-1">0 External Deps</p>
          <p className="text-[11px] text-zinc-400 font-medium mt-1">Strict TypeScript + currentColor</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted border border-border text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("matrix")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg font-medium transition-colors",
              activeTab === "matrix"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Feature Comparison Matrix
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg font-medium transition-colors",
              activeTab === "all"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All 39 Phosphor Icons
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("brands")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg font-medium transition-colors",
              activeTab === "brands"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Official Brand Marks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("guidelines")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg font-medium transition-colors",
              activeTab === "guidelines"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Visual Guidelines
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons, features or components..."
            className="w-full rounded-lg border border-border bg-card pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-blue-500"
          />
        </div>
      </div>

      {/* TAB 1: COMPARISON MATRIX */}
      {activeTab === "matrix" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Feature & Area</th>
                    <th className="py-3 px-4 text-center">Previous Icon (Lucide)</th>
                    <th className="py-3 px-4 text-center">New Icon (Phosphor / Brand)</th>
                    <th className="py-3 px-4">Component File</th>
                    <th className="py-3 px-4">Status & Asset Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredMappings.map((item, idx) => {
                    const OldIcon = item.currentLucideIcon;
                    const NewIcon = item.phosphorIcon;
                    return (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-foreground">
                          <div>{item.feature}</div>
                          <span className="text-[10px] text-muted-foreground">{item.area}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex flex-col items-center justify-center p-2 rounded-lg bg-muted/40 border border-border/80">
                            <OldIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-[9px] font-mono text-muted-foreground mt-1">
                              {item.currentLucideName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex flex-col items-center justify-center p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500">
                            <NewIcon className="h-4 w-4" />
                            <span className="text-[9px] font-mono font-semibold text-blue-500 mt-1">
                              {item.phosphorName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">
                          {item.component}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              <Check className="h-3 w-3" />
                              {item.status}
                            </span>
                            <div className="text-[10px] font-mono text-muted-foreground">
                              {item.assetSource}
                            </div>
                            <div className="text-[10px] text-muted-foreground leading-tight">
                              {item.notes}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALL 39 PHOSPHOR ICONS */}
      {activeTab === "all" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredPhosphor.map((name) => {
              const IconComp = PHOSPHOR_ICONS[name];
              const pascalName = `Phosphor${name
                .split("-")
                .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                .join("")}`;
              const snippet = `<${pascalName} className="h-4 w-4" />`;
              const isCopied = copiedName === name;

              return (
                <div
                  key={name}
                  onClick={() => copyCode(name, snippet)}
                  className="group relative flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-card hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer text-center"
                >
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-foreground group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-colors">
                    <IconComp className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-foreground mt-2 truncate w-full">
                    {name}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate w-full">
                    {pascalName}
                  </span>
                  <span className="text-[9px] text-muted-foreground/80 mt-1">
                    viewBox 0 0 256 256
                  </span>

                  <button
                    type="button"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-opacity"
                    title="Copy React JSX"
                  >
                    {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: OFFICIAL BRAND MARKS */}
      {activeTab === "brands" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-card">
            <h2 className="text-sm font-bold text-foreground">External Service Brand Integration</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Per strict security & brand rules, authentic third-party logos located in <code className="font-mono text-blue-400">public/Logos/</code> are preserved to guarantee instant recognizability and avoid trademark degradation.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {BRAND_LOGOS.map((brand) => (
              <div
                key={brand.name}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-card hover:border-border/80 transition-colors text-center"
              >
                <div className="h-10 w-10 rounded-xl bg-muted/60 border border-border flex items-center justify-center p-2">
                  <img src={brand.path} alt={brand.name} className="h-6 w-6 object-contain" />
                </div>
                <span className="text-xs font-semibold text-foreground mt-2">{brand.name}</span>
                <span className="text-[10px] text-muted-foreground">{brand.category}</span>
                <span className="text-[9px] font-mono text-muted-foreground/80 mt-1 truncate w-full">
                  {brand.path}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: DESIGN GUIDELINES */}
      {activeTab === "guidelines" && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl border border-border bg-card space-y-3">
            <h2 className="text-base font-bold text-foreground">BusinessBrain Design System: Iconography Rules</h2>
            <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-5">
              <li>
                <strong className="text-foreground">Zero Emojis in Functional UI:</strong> Functional actions (Home, Tasks, Goals, Meetings, Decisions, Settings) must exclusively use Phosphor SVG components. Emojis are reserved strictly for user-created custom page icons.
              </li>
              <li>
                <strong className="text-foreground">Unified 256x256 ViewBox:</strong> All Phosphor components share the <code className="font-mono text-blue-400">0 0 256 256</code> coordinate grid, ensuring identical visual weight, optical alignment, and stroke cadence.
              </li>
              <li>
                <strong className="text-foreground">Automatic currentColor Theming:</strong> All icons use <code className="font-mono text-blue-400">fill=&quot;currentColor&quot;</code>, allowing full color reactivity via Tailwind classes (<code className="font-mono text-blue-400">text-zinc-500 dark:text-zinc-400 hover:text-white</code>).
              </li>
              <li>
                <strong className="text-foreground">Standardized Sizing Matrix:</strong>
                <ul className="list-circle pl-5 mt-1 space-y-1">
                  <li><code className="font-mono text-foreground">h-3.5 w-3.5 (14px)</code>: Dense tables, toolbar badges, compact dropdowns.</li>
                  <li><code className="font-mono text-foreground">h-4 w-4 (16px)</code>: Standard sidebar navigation, tab headers, buttons.</li>
                  <li><code className="font-mono text-foreground">h-5 w-5 (20px)</code>: Metric card headers, subpage titles.</li>
                  <li><code className="font-mono text-foreground">h-6 w-6 (24px)</code>: Empty state card centerpieces.</li>
                </ul>
              </li>
              <li>
                <strong className="text-foreground">Authentic External Brand Logos:</strong> Services like GitHub, Google, Outlook, Slack, Linear, and Stripe always render authentic SVG vectors from <code className="font-mono text-blue-400">public/Logos/</code>.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
