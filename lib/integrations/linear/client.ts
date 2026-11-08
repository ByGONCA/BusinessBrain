// ==============================================================================
// KogSync: Linear Raw GraphQL Query Client
// ==============================================================================

import { linearGraphQLFetch } from "./graphql-client";
import {
  RawLinearViewer,
  RawLinearIssue,
  RawLinearProject,
  RawLinearCycle,
  RawLinearTeam,
} from "./types";

const VIEWER_QUERY = /* GraphQL */ `
  query GetLinearViewer {
    viewer {
      id
      name
      email
      avatarUrl
      organization {
        id
        name
        urlKey
        logoUrl
      }
    }
  }
`;

const ISSUES_QUERY = /* GraphQL */ `
  query GetLinearIssues($first: Int, $after: String) {
    issues(first: $first, after: $after, orderBy: updatedAt) {
      nodes {
        id
        identifier
        title
        description
        priority
        priorityLabel
        estimate
        dueDate
        createdAt
        updatedAt
        completedAt
        canceledAt
        url
        state {
          id
          name
          color
          type
          position
        }
        assignee {
          id
          name
          displayName
          email
          avatarUrl
          active
        }
        team {
          id
          key
          name
        }
        project {
          id
          name
        }
        cycle {
          id
          number
          name
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const PROJECTS_QUERY = /* GraphQL */ `
  query GetLinearProjects($first: Int) {
    projects(first: $first, orderBy: updatedAt) {
      nodes {
        id
        name
        description
        state
        progress
        targetDate
        startDate
        url
        lead {
          id
          name
          displayName
        }
      }
    }
  }
`;

const CYCLES_QUERY = /* GraphQL */ `
  query GetLinearCycles($first: Int) {
    cycles(first: $first) {
      nodes {
        id
        number
        name
        startsAt
        endsAt
        completedAt
        progress
      }
    }
  }
`;

const TEAMS_QUERY = /* GraphQL */ `
  query GetLinearTeams($first: Int) {
    teams(first: $first) {
      nodes {
        id
        key
        name
        description
        states {
          nodes {
            id
            name
            type
          }
        }
        members {
          nodes {
            id
            name
          }
        }
      }
    }
  }
`;

export async function fetchLinearViewer(organizationId: string): Promise<RawLinearViewer> {
  const data = await linearGraphQLFetch<{ viewer: RawLinearViewer }>(organizationId, VIEWER_QUERY);
  return data.viewer;
}

export async function fetchLinearIssues(
  organizationId: string,
  params?: { first?: number; after?: string }
): Promise<{ nodes: RawLinearIssue[]; hasNextPage: boolean; endCursor?: string }> {
  const data = await linearGraphQLFetch<{
    issues: {
      nodes: RawLinearIssue[];
      pageInfo: { hasNextPage: boolean; endCursor?: string };
    };
  }>(organizationId, ISSUES_QUERY, { first: params?.first || 50, after: params?.after });

  return {
    nodes: data.issues?.nodes || [],
    hasNextPage: Boolean(data.issues?.pageInfo?.hasNextPage),
    endCursor: data.issues?.pageInfo?.endCursor,
  };
}

export async function fetchLinearProjects(
  organizationId: string,
  first = 30
): Promise<RawLinearProject[]> {
  const data = await linearGraphQLFetch<{ projects: { nodes: RawLinearProject[] } }>(
    organizationId,
    PROJECTS_QUERY,
    { first }
  );
  return data.projects?.nodes || [];
}

export async function fetchLinearCycles(
  organizationId: string,
  first = 20
): Promise<RawLinearCycle[]> {
  const data = await linearGraphQLFetch<{ cycles: { nodes: RawLinearCycle[] } }>(
    organizationId,
    CYCLES_QUERY,
    { first }
  );
  return data.cycles?.nodes || [];
}

export async function fetchLinearTeams(
  organizationId: string,
  first = 20
): Promise<RawLinearTeam[]> {
  const data = await linearGraphQLFetch<{ teams: { nodes: RawLinearTeam[] } }>(
    organizationId,
    TEAMS_QUERY,
    { first }
  );
  return data.teams?.nodes || [];
}
