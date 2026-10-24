// ==============================================================================
// Company Brain: API Key Scopes Registry
// ==============================================================================

import { ApiKeyScope } from "./types";

export interface ScopeDefinition {
  scope: ApiKeyScope;
  name: string;
  description: string;
  category: "projects" | "documents" | "metrics" | "integrations" | "system";
}

export const API_KEY_SCOPES: ScopeDefinition[] = [
  {
    scope: "admin",
    name: "Full Administrator Access",
    description: "Grants unrestricted read and write access across all workspace API endpoints.",
    category: "system",
  },
  {
    scope: "read:projects",
    name: "Read Projects",
    description: "Allows reading project details, statuses, and team assignments.",
    category: "projects",
  },
  {
    scope: "write:projects",
    name: "Write Projects",
    description: "Allows creating, updating, and managing workspace projects.",
    category: "projects",
  },
  {
    scope: "read:documents",
    name: "Read Documents",
    description: "Allows reading published knowledge pages and imported documents.",
    category: "documents",
  },
  {
    scope: "write:documents",
    name: "Write Documents",
    description: "Allows creating and editing knowledge documents and page nodes.",
    category: "documents",
  },
  {
    scope: "read:metrics",
    name: "Read Metrics & Analytics",
    description: "Allows reading business analytics, SaaS financial metrics, and velocity indicators.",
    category: "metrics",
  },
  {
    scope: "read:integrations",
    name: "Read Integrations",
    description: "Allows inspecting connected workspace integrations and sync logs.",
    category: "integrations",
  },
  {
    scope: "read:discussions",
    name: "Read Discussions",
    description: "Allows querying synced GitHub PRs, issues, and Slack communications.",
    category: "integrations",
  },
];

/**
 * Validates whether granted scopes satisfy a required scope.
 * The 'admin' scope satisfies any required scope.
 */
export function hasScope(grantedScopes: ApiKeyScope[], requiredScope?: ApiKeyScope): boolean {
  if (!requiredScope) return true;
  if (grantedScopes.includes("admin")) return true;
  return grantedScopes.includes(requiredScope);
}
