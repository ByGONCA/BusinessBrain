import { z } from "zod";

export type CompanyEntityType =
  | "project"
  | "task"
  | "meeting"
  | "goal"
  | "person"
  | "decision"
  | "document";

export interface EntityMetadata {
  status?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  due_date?: string | null;
  target_date?: string | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
  notes?: string;
  completed?: boolean;
  completed_at?: string | null;
  [key: string]: unknown;
}

export interface CompanyEntity {
  id: string;
  organization_id: string;
  type: CompanyEntityType;
  title: string;
  content: string;
  metadata: EntityMetadata;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMemberOption {
  id: string; // user_id
  memberId: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}

export interface EntityActivityChangeItem {
  old: unknown;
  new: unknown;
}

export interface EntityActivityRecord {
  id: string;
  organization_id: string;
  entity_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action:
    | "entity_created"
    | "status_changed"
    | "priority_changed"
    | "due_date_changed"
    | "assignee_changed"
    | "content_updated"
    | "details_updated"
    | "entity_deleted";
  changes: Record<string, EntityActivityChangeItem>;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type EntityViewMode = "cards" | "table" | "kanban";

export const createEntitySchema = z.object({
  type: z.enum([
    "project",
    "task",
    "meeting",
    "goal",
    "person",
    "decision",
    "document",
  ]),
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  content: z.string().default(""),
  metadata: z.record(z.unknown()).default({}),
});

export const updateEntitySchema = z.object({
  id: z.string().uuid("Invalid entity ID"),
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long").optional(),
  content: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  assigneeName: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
