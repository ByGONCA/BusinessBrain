// ==============================================================================
// Company Brain: Knowledge Importers Type Definitions
// Unified models for Confluence & Notion import jobs and hierarchy trees
// ==============================================================================

export type ImportSourcePlatform = "confluence" | "notion" | "google_drive" | "markdown";

export interface ImportedDocumentNode {
  sourceId: string;
  sourcePlatform: ImportSourcePlatform;
  parentSourceId?: string;
  title: string;
  contentMarkdown: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
  contentHash: string;
}

export interface ImportBatchResult {
  success: boolean;
  platform: ImportSourcePlatform;
  totalFound: number;
  importedCount: number;
  skippedDuplicates: number;
  failedCount: number;
  durationMs: number;
  syncLogId?: string;
  errors?: string[];
}

export interface ConfluenceSpaceSummary {
  key: string;
  name: string;
  type: string;
  description?: string;
}

export interface NotionDatabaseSummary {
  id: string;
  title: string;
  url: string;
  createdTime: string;
}
