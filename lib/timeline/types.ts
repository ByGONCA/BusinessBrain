export type TimelineEventType =
  | "company_founded"
  | "member_joined"
  | "plan_activated"
  | "integration_connected"
  | "project_created"
  | "decision_recorded"
  | "task_completed"
  | "meeting_held"
  | "document_created"
  | "goal_created"
  | "team_created"
  | "activity_recorded";

export type TimelineCategory =
  | "milestone"
  | "decision"
  | "project"
  | "team"
  | "billing"
  | "work"
  | "memory";

export type TimelineImportanceTier = "major" | "normal" | "minor";

export interface TimelineAuthor {
  id?: string;
  name: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

export interface TimelineLink {
  label: string;
  href: string;
}

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  category: TimelineCategory;
  importance?: TimelineImportanceTier;
  title: string;
  description: string;
  timestamp: string; // ISO 8601 string
  author?: TimelineAuthor;
  metadata?: Record<string, unknown>;
  link?: TimelineLink;
  entityId?: string;
  entityType?: string;
}

export type TimelineZoomLevel = "1Y" | "6M" | "3M" | "1M" | "1W" | "1D";

export type TimelineZoomTier = "overview" | "exploration" | "detail";

export type TimelineTimeRange = "all" | "30d" | "90d" | "ytd" | "1y";

export type TimelineViewMode = "timeline" | "list";

export type TimelineFilter = "all" | TimelineCategory;
