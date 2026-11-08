// ==============================================================================
// KogSync: Linear Normalized Intelligence Data Provider Services
// Reusable, decoupled service layer for KogSync Intelligence Engine
// ==============================================================================

import {
  fetchLinearViewer,
  fetchLinearIssues,
  fetchLinearProjects,
  fetchLinearCycles,
  fetchLinearTeams,
} from "./client";
import {
  RawLinearIssue,
  RawLinearProject,
  RawLinearCycle,
  RawLinearTeam,
  NormalizedLinearIssue,
  NormalizedLinearProject,
  NormalizedLinearCycle,
  NormalizedLinearTeam,
  LinearIntelligenceSnapshot,
  LinearVelocityMetrics,
  LinearProviderHealth,
  IssueStateCategory,
  IssuePriorityLevel,
  ProviderReadinessLevel,
} from "./types";
import { getDecryptedLinearTokens } from "./graphql-client";
import { logger } from "@/lib/security/logger";

// ------------------------------------------------------------------------------
// 1. DATA NORMALIZATION MAPPERS
// ------------------------------------------------------------------------------

export function mapPriorityLevel(priority: number): { level: IssuePriorityLevel; rank: number } {
  switch (priority) {
    case 1:
      return { level: "urgent", rank: 1 };
    case 2:
      return { level: "high", rank: 2 };
    case 3:
      return { level: "medium", rank: 3 };
    case 4:
      return { level: "low", rank: 4 };
    default:
      return { level: "none", rank: 5 };
  }
}

export function mapStateCategory(type: string): IssueStateCategory {
  switch (type) {
    case "started":
      return "started";
    case "completed":
      return "completed";
    case "canceled":
      return "canceled";
    case "backlog":
    case "triage":
      return "backlog";
    default:
      return "unstarted";
  }
}

export function normalizeLinearIssue(raw: RawLinearIssue): NormalizedLinearIssue {
  const { level, rank } = mapPriorityLevel(raw.priority);
  const stateCategory = mapStateCategory(raw.state?.type || "unstarted");

  return {
    id: raw.id,
    identifier: raw.identifier,
    title: raw.title,
    descriptionSnippet: raw.description ? raw.description.slice(0, 200).trim() : "",
    stateCategory,
    stateName: raw.state?.name || "Unknown",
    priorityLevel: level,
    priorityRank: rank,
    assigneeName: raw.assignee?.name || raw.assignee?.displayName,
    assigneeEmail: raw.assignee?.email,
    teamKey: raw.team?.key || "",
    teamName: raw.team?.name || "",
    projectId: raw.project?.id,
    projectName: raw.project?.name,
    cycleId: raw.cycle?.id,
    cycleNumber: raw.cycle?.number,
    cycleName: raw.cycle?.name,
    estimatePoints: typeof raw.estimate === "number" ? raw.estimate : null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    completedAt: raw.completedAt || null,
    dueDate: raw.dueDate || null,
    linearUrl: raw.url,
  };
}

export function normalizeLinearProject(raw: RawLinearProject): NormalizedLinearProject {
  return {
    id: raw.id,
    name: raw.name,
    descriptionSnippet: raw.description ? raw.description.slice(0, 200).trim() : "",
    state: raw.state,
    progressPercentage: Math.round((raw.progress || 0) * 100),
    startDate: raw.startDate || null,
    targetDate: raw.targetDate || null,
    leadName: raw.lead?.name || raw.lead?.displayName || null,
    linearUrl: raw.url || null,
  };
}

export function normalizeLinearCycle(raw: RawLinearCycle): NormalizedLinearCycle {
  const now = Date.now();
  const startsAtMs = new Date(raw.startsAt).getTime();
  const endsAtMs = new Date(raw.endsAt).getTime();

  const isCurrent = now >= startsAtMs && now <= endsAtMs;
  const isFuture = now < startsAtMs;
  const isPast = now > endsAtMs;

  return {
    id: raw.id,
    number: raw.number,
    name: raw.name || `Cycle ${raw.number}`,
    startsAt: raw.startsAt,
    endsAt: raw.endsAt,
    progressPercentage: Math.round((raw.progress || 0) * 100),
    isCurrent,
    isFuture,
    isPast,
  };
}

export function normalizeLinearTeam(raw: RawLinearTeam): NormalizedLinearTeam {
  return {
    id: raw.id,
    key: raw.key,
    name: raw.name,
    workflowStatesCount: raw.states?.nodes?.length || 0,
    activeMembersCount: raw.members?.nodes?.length || 0,
  };
}

// ------------------------------------------------------------------------------
// 2. SAFEGUARD A: VELOCITY METRICS DERIVATION
// Strictly derived from actual retrieved data; never fabricated.
// ------------------------------------------------------------------------------

export function calculateVelocityMetrics(
  activeCycle: RawLinearCycle | null,
  cycleIssues: RawLinearIssue[]
): LinearVelocityMetrics {
  if (!activeCycle || cycleIssues.length === 0) {
    return {
      calculationMethod: "insufficient_data",
      periodReference: activeCycle ? `Cycle ${activeCycle.number}` : null,
      completedIssuesCount: 0,
      inProgressIssuesCount: 0,
      totalCycleIssuesCount: 0,
      completionRatePercentage: null,
      velocityStatus: "insufficient_data",
      explanation: "No active cycle or active cycle issues found to compute velocity.",
    };
  }

  const completed = cycleIssues.filter((i) => i.state?.type === "completed").length;
  const inProgress = cycleIssues.filter((i) => i.state?.type === "started").length;
  const total = cycleIssues.length;
  const completionRate = Math.round((completed / total) * 100);

  let status: "on_track" | "behind" | "insufficient_data" = "on_track";
  const expectedProgress = Math.round((activeCycle.progress || 0) * 100);

  if (completionRate < expectedProgress - 20) {
    status = "behind";
  }

  const startFormatted = new Date(activeCycle.startsAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endFormatted = new Date(activeCycle.endsAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return {
    calculationMethod: "cycle_issues_completed",
    periodReference: `Cycle ${activeCycle.number} (${startFormatted} - ${endFormatted})`,
    completedIssuesCount: completed,
    inProgressIssuesCount: inProgress,
    totalCycleIssuesCount: total,
    completionRatePercentage: completionRate,
    velocityStatus: status,
    explanation: `Based on ${completed}/${total} issues completed in Cycle ${activeCycle.number}.`,
  };
}

// ------------------------------------------------------------------------------
// 3. SAFEGUARD B & C: READINESS & PROVIDER HEALTH
// Never claims ready solely on auth. Requires live API access & data.
// ------------------------------------------------------------------------------

export function determineProviderReadiness(params: {
  hasValidTokens: boolean;
  apiAccessible: boolean;
  issuesCount: number;
  teamsCount: number;
}): { readiness: ProviderReadinessLevel; reason: string } {
  if (!params.hasValidTokens) {
    return { readiness: "not_ready", reason: "Linear is not connected or authorization expired." };
  }

  if (!params.apiAccessible) {
    return { readiness: "not_ready", reason: "Linear GraphQL API is currently unreachable." };
  }

  if (params.teamsCount > 0 && params.issuesCount >= 0) {
    return {
      readiness: "ready",
      reason: "Linear data successfully retrieved and normalized for Intelligence Engine consumption.",
    };
  }

  return {
    readiness: "partial",
    reason: "Connected with partial datasets available.",
  };
}

// ------------------------------------------------------------------------------
// 4. REUSABLE INTELLIGENCE PROVIDER SERVICE METHODS
// ------------------------------------------------------------------------------

/**
 * Generates an executive Intelligence Snapshot combining health, velocity,
 * workspace metadata, active cycle, and recent normalized items.
 */
export async function getLinearIntelligenceSnapshot(
  organizationId: string
): Promise<LinearIntelligenceSnapshot | null> {
  const tokenData = await getDecryptedLinearTokens(organizationId);
  if (!tokenData) {
    return null;
  }

  const timestamp = new Date().toISOString();

  try {
    const [viewer, issuesRes, projects, cycles, teams] = await Promise.all([
      fetchLinearViewer(organizationId),
      fetchLinearIssues(organizationId, { first: 50 }),
      fetchLinearProjects(organizationId, 20),
      fetchLinearCycles(organizationId, 10),
      fetchLinearTeams(organizationId, 20),
    ]);

    const rawIssues = issuesRes.nodes;
    const normalizedIssues = rawIssues.map(normalizeLinearIssue);
    const normalizedProjects = projects.map(normalizeLinearProject);
    const normalizedCycles = cycles.map(normalizeLinearCycle);

    // Identify active cycle
    const now = Date.now();
    const rawActiveCycle =
      cycles.find((c) => {
        const s = new Date(c.startsAt).getTime();
        const e = new Date(c.endsAt).getTime();
        return now >= s && now <= e;
      }) || null;

    const activeCycle = rawActiveCycle ? normalizeLinearCycle(rawActiveCycle) : null;

    // Filter issues in active cycle for velocity calculation
    const cycleIssues = rawActiveCycle
      ? rawIssues.filter((i) => i.cycle?.id === rawActiveCycle.id)
      : [];

    const velocityMetrics = calculateVelocityMetrics(rawActiveCycle, cycleIssues);

    const { readiness, reason } = determineProviderReadiness({
      hasValidTokens: true,
      apiAccessible: true,
      issuesCount: normalizedIssues.length,
      teamsCount: teams.length,
    });

    const providerHealth: LinearProviderHealth = {
      connected: true,
      apiAccessible: true,
      dataRetrieved: true,
      readiness,
      readinessReason: reason,
      lastRetrievedAt: timestamp,
      itemCounts: {
        issues: normalizedIssues.length,
        projects: normalizedProjects.length,
        cycles: normalizedCycles.length,
        teams: teams.length,
      },
    };

    return {
      providerHealth,
      velocityMetrics,
      workspace: {
        id: viewer.organization.id,
        name: viewer.organization.name,
        urlKey: viewer.organization.urlKey,
      },
      connectedAccount: {
        id: viewer.id,
        name: viewer.name,
        email: viewer.email,
        avatarUrl: viewer.avatarUrl,
      },
      activeCycle,
      activeProjects: normalizedProjects.filter((p) => p.state === "started" || p.state === "planned"),
      recentIssuesSample: normalizedIssues.slice(0, 5),
    };
  } catch (err) {
    logger.error("Failed to generate Linear intelligence snapshot", err, { organizationId });
    throw err;
  }
}

/**
 * Reusable service to fetch normalized issues for downstream AI or reporting consumers.
 */
export async function getNormalizedLinearIssues(
  organizationId: string,
  params?: { first?: number; after?: string }
): Promise<{ issues: NormalizedLinearIssue[]; hasNextPage: boolean; endCursor?: string }> {
  const result = await fetchLinearIssues(organizationId, params);
  return {
    issues: result.nodes.map(normalizeLinearIssue),
    hasNextPage: result.hasNextPage,
    endCursor: result.endCursor,
  };
}

/**
 * Reusable service to fetch normalized projects for project intelligence.
 */
export async function getNormalizedLinearProjects(
  organizationId: string
): Promise<NormalizedLinearProject[]> {
  const projects = await fetchLinearProjects(organizationId);
  return projects.map(normalizeLinearProject);
}

/**
 * Reusable service to fetch normalized cycles for sprint intelligence.
 */
export async function getNormalizedLinearCycles(
  organizationId: string
): Promise<NormalizedLinearCycle[]> {
  const cycles = await fetchLinearCycles(organizationId);
  return cycles.map(normalizeLinearCycle);
}

/**
 * Reusable service to fetch normalized teams.
 */
export async function getNormalizedLinearTeams(
  organizationId: string
): Promise<NormalizedLinearTeam[]> {
  const teams = await fetchLinearTeams(organizationId);
  return teams.map(normalizeLinearTeam);
}
