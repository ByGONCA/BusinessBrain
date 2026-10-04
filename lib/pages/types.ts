// ==============================================================================
// Company Brain: Pages & Notion-like Workspace Types
// ==============================================================================

export type BlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "bullet_list"
  | "numbered_list"
  | "checklist"
  | "quote"
  | "divider"
  | "code"
  | "callout";

export interface EditorBlock {
  id: string;
  type: BlockType;
  content: string; // Markdown/HTML inline text
  properties?: {
    checked?: boolean; // For checklist items
    language?: string; // For code blocks
    calloutIcon?: string; // For callout icons (e.g. 💡, ⚠️, ℹ️, 🎯)
    level?: number;
  };
}

export interface PageRecord {
  id: string;
  organization_id: string;
  parent_page_id: string | null;
  title: string;
  icon: string;
  content: EditorBlock[];
  content_text: string;
  position: number;
  is_favorite?: boolean;
  favorite_position?: number;
  is_archived: boolean;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageTreeNode extends PageRecord {
  children: PageTreeNode[];
}

export interface PageBreadcrumbItem {
  id: string;
  title: string;
  icon: string;
}

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  blocks: EditorBlock[];
}

export type EntityType =
  | "project"
  | "task"
  | "meeting"
  | "goal"
  | "person"
  | "page"
  | "decision"
  | "document";

export interface CompanyEntityRecord {
  id: string;
  organization_id: string;
  type: EntityType;
  title: string;
  content: string;
  metadata: {
    status?: string;
    priority?: string;
    dueDate?: string;
    assigneeName?: string;
    assigneeId?: string;
    outcome?: string;
    date?: string;
    tags?: string[];
    [key: string]: unknown;
  };
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

import { RelationshipType } from "@/lib/connections/types";

export interface PageConnectionRecord {
  id: string;
  organization_id: string;
  page_id: string;
  source_type: "page" | "block";
  source_id: string;
  target_type: EntityType;
  target_id: string;
  target_title: string;
  relationship_type?: RelationshipType;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PageViewMode = "editor" | "outline" | "connections";

