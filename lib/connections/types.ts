// ==============================================================================
// Company Brain: Company Connections & Graph Types
// ==============================================================================

export type EntityType =
  | "project"
  | "task"
  | "meeting"
  | "goal"
  | "person"
  | "page"
  | "decision"
  | "document";

export const RELATIONSHIP_TYPES = [
  "related_to",
  "part_of",
  "created_from",
  "depends_on",
  "blocks",
  "decided_in",
  "discussed_in",
  "assigned_to",
  "owned_by",
  "supports",
  "contradicts",
  "replaces",
  "derived_from",
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export interface RelationshipConfig {
  forward: string;
  reverse: string;
  description: string;
}

export const RELATIONSHIP_LABELS: Record<RelationshipType, RelationshipConfig> = {
  related_to: {
    forward: "Related to",
    reverse: "Related to",
    description: "General conceptual association between two objects",
  },
  part_of: {
    forward: "Part of",
    reverse: "Contains",
    description: "Hierarchical or component composition relationship",
  },
  created_from: {
    forward: "Created from",
    reverse: "Generated",
    description: "Provenance link showing where this object originated",
  },
  depends_on: {
    forward: "Depends on",
    reverse: "Prerequisite for",
    description: "Sequential or functional dependency",
  },
  blocks: {
    forward: "Blocks",
    reverse: "Blocked by",
    description: "Hard impediment preventing progress",
  },
  decided_in: {
    forward: "Decided in",
    reverse: "Decisions made",
    description: "Meeting or session where a decision was agreed upon",
  },
  discussed_in: {
    forward: "Discussed in",
    reverse: "Topics discussed",
    description: "Meeting, document, or page discussing this topic",
  },
  assigned_to: {
    forward: "Assigned to",
    reverse: "Assignee of",
    description: "Accountability or responsibility link to a person",
  },
  owned_by: {
    forward: "Owned by",
    reverse: "Owner of",
    description: "Organizational ownership or project lead relationship",
  },
  supports: {
    forward: "Supports",
    reverse: "Supported by",
    description: "Strategic alignment towards a goal or mission",
  },
  contradicts: {
    forward: "Contradicts",
    reverse: "Contradicted by",
    description: "Conflict or opposing decision requiring resolution",
  },
  replaces: {
    forward: "Replaces",
    reverse: "Replaced by",
    description: "Succession or deprecation relationship",
  },
  derived_from: {
    forward: "Derived from",
    reverse: "Source of",
    description: "Knowledge synthesis derived from notes or discussions",
  },
};

export interface CompanyConnectionRecord {
  id: string;
  organization_id: string;
  source_type: EntityType | "block";
  source_id: string;
  source_title: string;
  target_type: EntityType | "block";
  target_id: string;
  target_title: string;
  relationship_type: RelationshipType;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GraphNode {
  id: string;
  type: EntityType;
  title: string;
  icon?: string;
  metadata?: Record<string, unknown>;
  organization_id: string;
  degree: number;
  inDegree: number;
  outDegree: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  sourceType: EntityType | "block";
  target: string;
  targetType: EntityType | "block";
  relationshipType: RelationshipType;
  label: string;
  reverseLabel: string;
  metadata?: Record<string, unknown>;
}

export interface CompanyGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalConnections: number;
}

export interface HierarchyTreeNode {
  id: string;
  title: string;
  type: EntityType;
  icon?: string;
  children: HierarchyTreeNode[];
  connectionCount: number;
}

export interface ShortestPathResult {
  found: boolean;
  path: Array<{
    node: GraphNode;
    edge?: GraphEdge;
  }>;
  totalHops: number;
}
