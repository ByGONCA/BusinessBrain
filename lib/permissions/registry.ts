// ==============================================================================
// Company Brain: Canonical Permission Registry
// Machine-readable keys mapped to user-friendly titles, descriptions, and categories.
// ==============================================================================

export type PermissionCategory =
  | "people"
  | "teams"
  | "pages"
  | "projects"
  | "tasks"
  | "goals"
  | "meetings"
  | "brain"
  | "files"
  | "integrations"
  | "github"
  | "company"
  | "billing";

export interface PermissionDefinition {
  key: string;
  category: PermissionCategory;
  name: string;
  description: string;
}

export const PERMISSION_CATEGORIES: { id: PermissionCategory; label: string; icon: string }[] = [
  { id: "people", label: "People & Members", icon: "Users" },
  { id: "teams", label: "Teams & Squads", icon: "FolderGit2" },
  { id: "pages", label: "Pages & Docs", icon: "FileText" },
  { id: "projects", label: "Projects", icon: "FolderKanban" },
  { id: "tasks", label: "Tasks & Deliverables", icon: "CheckSquare" },
  { id: "goals", label: "Goals & Objectives", icon: "Target" },
  { id: "meetings", label: "Meetings & Calendar", icon: "Calendar" },
  { id: "brain", label: "Brain & Decisions", icon: "Brain" },
  { id: "files", label: "Files & Storage", icon: "File" },
  { id: "integrations", label: "Integrations", icon: "Layers" },
  { id: "github", label: "GitHub Workspace", icon: "Github" },
  { id: "company", label: "Company Settings", icon: "Building2" },
  { id: "billing", label: "Billing & Plans", icon: "CreditCard" },
];

export const PERMISSIONS_REGISTRY: PermissionDefinition[] = [
  // People
  {
    key: "people.view",
    category: "people",
    name: "View People",
    description: "Browse the workspace member directory, profiles, and team assignments.",
  },
  {
    key: "people.invite",
    category: "people",
    name: "Invite Members",
    description: "Invite new teammates to join the company workspace.",
  },
  {
    key: "people.edit",
    category: "people",
    name: "Edit People Info",
    description: "Update informational job titles, departments, and member profiles.",
  },
  {
    key: "people.remove",
    category: "people",
    name: "Remove Members",
    description: "Revoke workspace access and remove members from the company.",
  },
  {
    key: "people.manage_permissions",
    category: "people",
    name: "Manage Individual Permissions",
    description: "Grant direct permission overrides or explicit restrictions to members.",
  },

  // Teams
  {
    key: "teams.view",
    category: "teams",
    name: "View Teams",
    description: "See company teams, member rosters, and assigned capabilities.",
  },
  {
    key: "teams.create",
    category: "teams",
    name: "Create Teams",
    description: "Create arbitrary functional squads, departments, or project teams.",
  },
  {
    key: "teams.edit",
    category: "teams",
    name: "Edit Teams",
    description: "Rename teams, modify descriptions, and change theme colors.",
  },
  {
    key: "teams.delete",
    category: "teams",
    name: "Delete Teams",
    description: "Disband and delete company teams.",
  },
  {
    key: "teams.manage_members",
    category: "teams",
    name: "Manage Team Members",
    description: "Add or remove colleagues from teams.",
  },
  {
    key: "teams.manage_permissions",
    category: "teams",
    name: "Manage Team Permissions",
    description: "Define and update the permissions assigned to teams.",
  },

  // Pages
  {
    key: "pages.view",
    category: "pages",
    name: "View Pages",
    description: "Read documents, canvas pages, and company knowledge.",
  },
  {
    key: "pages.create",
    category: "pages",
    name: "Create Pages",
    description: "Create new documents, sub-pages, and canvas notes.",
  },
  {
    key: "pages.edit",
    category: "pages",
    name: "Edit Pages",
    description: "Edit canvas blocks, content, titles, and icons.",
  },
  {
    key: "pages.delete",
    category: "pages",
    name: "Delete Pages",
    description: "Archive or permanently delete pages.",
  },
  {
    key: "pages.share",
    category: "pages",
    name: "Share Pages",
    description: "Export pages or manage external sharing links.",
  },

  // Projects
  {
    key: "projects.view",
    category: "projects",
    name: "View Projects",
    description: "Access workspace projects and roadmaps.",
  },
  {
    key: "projects.create",
    category: "projects",
    name: "Create Projects",
    description: "Start new company projects and milestone initiatives.",
  },
  {
    key: "projects.edit",
    category: "projects",
    name: "Edit Projects",
    description: "Update project metadata, dates, and health statuses.",
  },
  {
    key: "projects.delete",
    category: "projects",
    name: "Delete Projects",
    description: "Remove projects from workspace.",
  },

  // Tasks
  {
    key: "tasks.view",
    category: "tasks",
    name: "View Tasks",
    description: "Browse task boards, lists, and deliverables.",
  },
  {
    key: "tasks.create",
    category: "tasks",
    name: "Create Tasks",
    description: "Add tasks and action items.",
  },
  {
    key: "tasks.edit",
    category: "tasks",
    name: "Edit Tasks",
    description: "Update task statuses, descriptions, and priorities.",
  },
  {
    key: "tasks.delete",
    category: "tasks",
    name: "Delete Tasks",
    description: "Delete tasks from boards.",
  },
  {
    key: "tasks.assign",
    category: "tasks",
    name: "Assign Tasks",
    description: "Assign tasks to team members.",
  },

  // Goals
  {
    key: "goals.view",
    category: "goals",
    name: "View Goals",
    description: "View strategic corporate goals and OKRs.",
  },
  {
    key: "goals.create",
    category: "goals",
    name: "Create Goals",
    description: "Establish new strategic company goals.",
  },
  {
    key: "goals.edit",
    category: "goals",
    name: "Edit Goals",
    description: "Update goal progress, metrics, and key results.",
  },
  {
    key: "goals.delete",
    category: "goals",
    name: "Delete Goals",
    description: "Archive or remove company goals.",
  },

  // Meetings
  {
    key: "meetings.view",
    category: "meetings",
    name: "View Meetings",
    description: "Browse meeting notes, schedules, and agendas.",
  },
  {
    key: "meetings.create",
    category: "meetings",
    name: "Create Meetings",
    description: "Schedule meetings and author agendas.",
  },
  {
    key: "meetings.edit",
    category: "meetings",
    name: "Edit Meetings",
    description: "Update meeting entries, notes, and action points.",
  },
  {
    key: "meetings.delete",
    category: "meetings",
    name: "Delete Meetings",
    description: "Remove meeting records.",
  },

  // Brain
  {
    key: "brain.view",
    category: "brain",
    name: "View Company Brain",
    description: "Explore the company map, decisions log, and organizational memory timeline.",
  },
  {
    key: "brain.create",
    category: "brain",
    name: "Record Decisions",
    description: "Log company decisions and establish entity links.",
  },
  {
    key: "brain.edit",
    category: "brain",
    name: "Edit Brain & Decisions",
    description: "Update decision rationales, consequences, and entity nodes.",
  },
  {
    key: "brain.manage",
    category: "brain",
    name: "Manage Knowledge Graph",
    description: "Manage cross-entity connections and company map hierarchies.",
  },

  // Files
  {
    key: "files.view",
    category: "files",
    name: "View Files",
    description: "Access internal company files and document attachments.",
  },
  {
    key: "files.upload",
    category: "files",
    name: "Upload Files",
    description: "Upload assets and media to workspace storage.",
  },
  {
    key: "files.delete",
    category: "files",
    name: "Delete Files",
    description: "Delete files from organization repository.",
  },

  // Integrations
  {
    key: "integrations.view",
    category: "integrations",
    name: "View Integrations",
    description: "Check status of connected services (Google, Slack, GitHub).",
  },
  {
    key: "integrations.connect",
    category: "integrations",
    name: "Connect Integrations",
    description: "Authorize OAuth connections for workspace integrations.",
  },
  {
    key: "integrations.configure",
    category: "integrations",
    name: "Configure Integrations",
    description: "Modify integration settings and synchronization scopes.",
  },
  {
    key: "integrations.disconnect",
    category: "integrations",
    name: "Disconnect Integrations",
    description: "Revoke and unlink external service connections.",
  },

  // GitHub
  {
    key: "github.view",
    category: "github",
    name: "View GitHub Data",
    description: "View connected repositories, pull requests, issues, and commits in BusinessBrain.",
  },
  {
    key: "github.manage_connection",
    category: "github",
    name: "Manage GitHub Connection",
    description: "Connect or disconnect the company GitHub App integration.",
  },
  {
    key: "github.manage_repositories",
    category: "github",
    name: "Manage Repositories",
    description: "Choose which GitHub repositories are imported and connected to company objects.",
  },
  {
    key: "github.view_activity",
    category: "github",
    name: "View GitHub Activity",
    description: "Access contributor statistics and live timeline activity.",
  },

  // Company Settings
  {
    key: "company.view_settings",
    category: "company",
    name: "View Workspace Settings",
    description: "View workspace details, defaults, and branding configurations.",
  },
  {
    key: "company.edit_settings",
    category: "company",
    name: "Edit Workspace Settings",
    description: "Change workspace name, logo, typography, and company preferences.",
  },

  // Billing
  {
    key: "billing.view",
    category: "billing",
    name: "View Billing",
    description: "Inspect active subscription tier, trial timer, and invoices.",
  },
  {
    key: "billing.manage",
    category: "billing",
    name: "Manage Billing",
    description: "Upgrade plan, manage payment methods in Stripe portal, or cancel subscription.",
  },
];

export const PERMISSION_KEYS = PERMISSIONS_REGISTRY.map((p) => p.key) as readonly string[];
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const PERMISSION_SET = new Set<string>(PERMISSION_KEYS);

export function isValidPermissionKey(key: string): key is PermissionKey {
  return PERMISSION_SET.has(key);
}

export function getPermissionsByCategory(cat: PermissionCategory): PermissionDefinition[] {
  return PERMISSIONS_REGISTRY.filter((p) => p.category === cat);
}
