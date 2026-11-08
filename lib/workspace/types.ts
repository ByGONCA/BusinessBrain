/**
 * lib/workspace/types.ts
 *
 * Strict TypeScript types for Workspace Node Hierarchy and Data Access.
 * All entities are strictly tenant-scoped via organizationId.
 */

export type WorkspaceNodeType =
  | 'organization'
  | 'team'
  | 'page'
  | 'document'
  | 'project'
  | 'connection';

export interface WorkspaceNode {
  id: string;
  organizationId: string;
  title: string;
  type: WorkspaceNodeType;
  parentId: string | null;
  path: string;
  icon?: string;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceHierarchy {
  organizationId: string;
  rootNodes: WorkspaceNode[];
  totalNodes: number;
  generatedAt: string;
}

export interface WorkspaceQueryFilter {
  organizationId: string;
  type?: WorkspaceNodeType;
  parentId?: string | null;
  includeArchived?: boolean;
}
