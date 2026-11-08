// ==============================================================================
// KogSync: Linear Intelligence Data Provider — Raw & Normalized Types
// Decoupled contracts for KogSync Intelligence Engine consumption
// ==============================================================================

// ------------------------------------------------------------------------------
// 1. RAW GRAPHQL RESPONSE SCHEMAS
// ------------------------------------------------------------------------------

export interface LinearGraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
}

export interface LinearGraphQLResponse<T> {
  data?: T;
  errors?: LinearGraphQLError[];
}

export interface LinearPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

export interface RawLinearViewer {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  organization: {
    id: string;
    name: string;
    urlKey: string;
    logoUrl?: string;
  };
}

export interface RawLinearState {
  id: string;
  name: string;
  color: string;
  type: "triage" | "backlog" | "unstarted" | "started" | "completed" | "canceled";
  position: number;
}

export interface RawLinearUser {
  id: string;
  name: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  active: boolean;
}

export interface RawLinearTeam {
  id: string;
  key: string;
  name: string;
  description?: string;
  states?: {
    nodes: RawLinearState[];
  };
  members?: {
    nodes: RawLinearUser[];
  };
}

export interface RawLinearCycle {
  id: string;
  number: number;
  name?: string;
  startsAt: string;
  endsAt: string;
  completedAt?: string;
  progress: number;
  scopeHistory?: number[];
  completedScopeHistory?: number[];
  inProgressScopeHistory?: number[];
  issueCountHistory?: number[];
}

export interface RawLinearProject {
  id: string;
  name: string;
  description?: string;
  state: "planned" | "started" | "paused" | "completed" | "canceled";
  progress: number;
  targetDate?: string;
  startDate?: string;
  lead?: RawLinearUser;
  url?: string;
}

export interface RawLinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number; // 0 = None, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low
  priorityLabel: string;
  state: RawLinearState;
  assignee?: RawLinearUser;
  team: {
    id: string;
    key: string;
    name: string;
  };
  project?: {
    id: string;
    name: string;
  };
  cycle?: {
    id: string;
    number: number;
    name?: string;
  };
  estimate?: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  canceledAt?: string;
  url: string;
}

// ------------------------------------------------------------------------------
// 2. NORMALIZED CONTRACTS FOR KOGSYNC INTELLIGENCE ENGINE
// Clean, presentation-independent structures consumable by future AI modules
// ------------------------------------------------------------------------------

export type IssueStateCategory = "backlog" | "unstarted" | "started" | "completed" | "canceled";
export type IssuePriorityLevel = "urgent" | "high" | "medium" | "low" | "none";

export interface NormalizedLinearIssue {
  id: string;
  identifier: string; // e.g. "ENG-42"
  title: string;
  descriptionSnippet: string;
  stateCategory: IssueStateCategory;
  stateName: string;
  priorityLevel: IssuePriorityLevel;
  priorityRank: number; // 1 (urgent) to 5 (none) for sorting
  assigneeName?: string;
  assigneeEmail?: string;
  teamKey: string;
  teamName: string;
  projectId?: string;
  projectName?: string;
  cycleId?: string;
  cycleNumber?: number;
  cycleName?: string;
  estimatePoints: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  dueDate: string | null;
  linearUrl: string;
}

export interface NormalizedLinearProject {
  id: string;
  name: string;
  descriptionSnippet: string;
  state: string;
  progressPercentage: number;
  startDate: string | null;
  targetDate: string | null;
  leadName: string | null;
  linearUrl: string | null;
}

export interface NormalizedLinearCycle {
  id: string;
  number: number;
  name: string;
  startsAt: string;
  endsAt: string;
  progressPercentage: number;
  isCurrent: boolean;
  isFuture: boolean;
  isPast: boolean;
}

export interface NormalizedLinearTeam {
  id: string;
  key: string;
  name: string;
  workflowStatesCount: number;
  activeMembersCount: number;
}

// ------------------------------------------------------------------------------
// 3. VELOCITY METRICS & PROVIDER HEALTH SAFEGUARDS
// Strictly calculated from actual data; never fabricated or guessed.
// ------------------------------------------------------------------------------

export interface LinearHistoricalVelocity {
  averageIssuesPerCycle: number | null;
  completedCyclesAnalyzed: number;
  status: "measured" | "insufficient_historical_data";
  explanation: string;
}

export interface LinearVelocityMetrics {
  calculationMethod: "cycle_issues_completed" | "insufficient_data";
  periodReference: string | null; // e.g. "Cycle 14 (Nov 1 - Nov 15)"
  completedIssuesCount: number;
  inProgressIssuesCount: number;
  totalCycleIssuesCount: number;
  cycle_completion_rate: number | null; // e.g. 75 (%)
  completionRatePercentage: number | null; // backward compatibility alias
  velocityStatus: "on_track" | "behind" | "insufficient_data";
  deliveryVelocity: LinearHistoricalVelocity;
  explanation: string;
}

export type ProviderReadinessLevel = "ready" | "partial" | "not_ready";

export interface LinearProviderHealth {
  connected: boolean;
  apiAccessible: boolean;
  dataRetrieved: boolean;
  readiness: ProviderReadinessLevel;
  readinessReason: string;
  lastRetrievedAt: string;
  itemCounts: {
    issues: number;
    projects: number;
    cycles: number;
    teams: number;
  };
}

export interface LinearIntelligenceSnapshot {
  providerHealth: LinearProviderHealth;
  velocityMetrics: LinearVelocityMetrics;
  workspace: {
    id: string;
    name: string;
    urlKey: string;
  };
  connectedAccount: {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
  };
  activeCycle: NormalizedLinearCycle | null;
  activeProjects: NormalizedLinearProject[];
  recentIssuesSample: NormalizedLinearIssue[]; // Concise preview (latest 5-10)
}
