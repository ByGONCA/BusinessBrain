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
  | "toggle"
  | "quote"
  | "divider"
  | "code"
  | "callout"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "bookmark"
  | "table"
  | "board"
  | "gallery"
  | "list"
  | "calendar"
  | "equation"
  | "table_of_contents"
  | "breadcrumb"
  | "button";

export type RelationType =
  | "related_to"
  | "part_of"
  | "created_from"
  | "depends_on"
  | "blocks"
  | "decided_in"
  | "discussed_in"
  | "assigned_to"
  | "owned_by"
  | "supports"
  | "contradicts"
  | "replaces"
  | "derived_from";

export const RELATION_LABELS: Record<RelationType, string> = {
  related_to: "Related to",
  part_of: "Part of",
  created_from: "Created from",
  depends_on: "Depends on",
  blocks: "Blocks",
  decided_in: "Decided in",
  discussed_in: "Discussed in",
  assigned_to: "Assigned to",
  owned_by: "Owned by",
  supports: "Supports",
  contradicts: "Contradicts",
  replaces: "Replaces",
  derived_from: "Derived from",
};

export interface TableBlockData {
  headers: string[];
  rows: string[][];
}

export interface BoardCard {
  id: string;
  text: string;
}

export interface BoardColumn {
  id: string;
  title: string;
  cards: BoardCard[];
}

export interface BoardBlockData {
  columns: BoardColumn[];
}

export interface GalleryItem {
  id: string;
  title: string;
  image?: string;
  tag?: string;
}

export interface GalleryBlockData {
  items: GalleryItem[];
}

export interface ListItemData {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
}

export interface ListBlockData {
  items: ListItemData[];
}

export interface CalendarEventData {
  id: string;
  title: string;
  date: string;
  tag?: string;
}

export interface CalendarBlockData {
  events: CalendarEventData[];
}

export interface ButtonBlockData {
  label: string;
  url?: string;
  action?: string;
}

export interface EditorBlockProperties {
  checked?: boolean; // For checklist items
  language?: string; // For code blocks
  calloutIcon?: string; // For callout icons (e.g. 💡, ⚠️, ℹ️, 🎯)
  level?: number;
  isOpen?: boolean; // For toggle blocks
  mediaUrl?: string; // For image, video, audio, file
  fileId?: string; // Reference to organization_files.id
  storageProvider?: string; // e.g. 'company_brain', 'google_drive'
  mimeType?: string;
  fileStatus?: string; // 'ready', 'unavailable', 'error'
  fileName?: string;
  fileSize?: string;
  caption?: string;
  bookmarkUrl?: string;
  bookmarkTitle?: string;
  bookmarkDescription?: string;
  tableData?: TableBlockData;
  boardData?: BoardBlockData;
  galleryData?: GalleryBlockData;
  listData?: ListBlockData;
  calendarData?: CalendarBlockData;
  equationFormula?: string;
  buttonData?: ButtonBlockData;
  [key: string]: unknown;
}

export interface EditorBlock {
  id: string;
  type: BlockType;
  content: string; // Markdown/HTML inline text
  properties?: EditorBlockProperties;
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
  | "document"
  | "file";

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

