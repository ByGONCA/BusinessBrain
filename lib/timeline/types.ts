export type TimelineEventType =
  | "company_founded"
  | "member_joined"
  | "plan_activated"
  | "integration_connected"
  | "project_created"
  | "decision_recorded"
  | "task_completed"
  | "meeting_held"
  | "document_created";

export type TimelineCategory = "milestone" | "team" | "billing" | "work" | "memory";

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
  title: string;
  description: string;
  timestamp: string; // ISO 8601 string
  author?: TimelineAuthor;
  metadata?: Record<string, unknown>;
  link?: TimelineLink;
}

export type TimelineZoomLevel = "1Y" | "6M" | "3M" | "1M" | "1W" | "1D";

export type TimelineFilter = "all" | TimelineCategory;
