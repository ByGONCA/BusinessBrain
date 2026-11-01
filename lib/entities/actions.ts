"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization, getOrganizationMembers } from "@/lib/organizations/queries";
import { hasPermission } from "@/lib/permissions/resolver";
import { PermissionKey } from "@/lib/permissions/registry";
import { logger } from "@/lib/security/logger";
import {
  createEntitySchema,
  updateEntitySchema,
  CompanyEntity,
  CompanyEntityType,
  WorkspaceMemberOption,
  EntityActivityRecord,
} from "./types";

const CREATE_PERMISSION_MAP: Record<CompanyEntityType, PermissionKey> = {
  goal: "goals.create",
  decision: "brain.create",
  task: "tasks.create",
  project: "projects.create",
  meeting: "meetings.create",
  person: "people.invite",
  document: "pages.create",
};

const EDIT_PERMISSION_MAP: Record<CompanyEntityType, PermissionKey> = {
  goal: "goals.edit",
  decision: "brain.edit",
  task: "tasks.edit",
  project: "projects.edit",
  meeting: "meetings.edit",
  person: "people.view",
  document: "pages.create",
};

const DELETE_PERMISSION_MAP: Record<CompanyEntityType, PermissionKey> = {
  goal: "goals.delete",
  decision: "brain.manage",
  task: "tasks.delete",
  project: "projects.delete",
  meeting: "meetings.delete",
  person: "people.delete",
  document: "pages.delete",
};

const VIEW_PERMISSION_MAP: Record<CompanyEntityType, PermissionKey> = {
  goal: "goals.view",
  decision: "brain.view",
  task: "tasks.view",
  project: "projects.view",
  meeting: "meetings.view",
  person: "people.view",
  document: "pages.view",
};

/**
 * Retrieves members of the active organization for assignment dropdowns.
 */
export async function getWorkspaceMembersAction(): Promise<{
  success: boolean;
  members?: WorkspaceMemberOption[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active workspace selected" };
    }

    const orgMembers = await getOrganizationMembers(activeOrg.id);

    const members: WorkspaceMemberOption[] = orgMembers.map((m) => {
      const name = m.profile?.full_name?.trim() || m.profile?.email?.split("@")[0] || "Team Member";
      return {
        id: m.user_id,
        memberId: m.id,
        fullName: name,
        email: m.profile?.email || "",
        role: m.role,
        avatarUrl: m.profile?.avatar_url || null,
      };
    });

    return {
      success: true,
      members,
    };
  } catch (err: unknown) {
    logger.error("Failed to get workspace members for assignment", err);
    return { success: false, error: "Failed to load members" };
  }
}

/**
 * Helper to record activity changes to public.entity_activity without throwing if table is not yet migrated.
 */
async function recordEntityActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    organizationId: string;
    entityId: string;
    actorId: string;
    actorName?: string | null;
    action: EntityActivityRecord["action"];
    changes: Record<string, { old: unknown; new: unknown }>;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await supabase.from("entity_activity").insert({
      organization_id: params.organizationId,
      entity_id: params.entityId,
      actor_id: params.actorId,
      actor_name: params.actorName || null,
      action: params.action,
      changes: params.changes || {},
      metadata: params.metadata || {},
    });
  } catch (e) {
    logger.warn("Could not insert entity_activity record", { error: e });
  }
}

/**
 * Creates a standalone company entity (Goal, Decision, Task, Project, Meeting)
 * scoped strictly to the caller's active organization with permission verification.
 */
export async function createCompanyEntityAction(input: {
  type: CompanyEntityType;
  title: string;
  content?: string;
  metadata?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  entity?: CompanyEntity;
  error?: string;
}> {
  try {
    const parsed = createEntitySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input data",
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active workspace selected" };
    }

    // Permission enforcement
    const requiredPerm = CREATE_PERMISSION_MAP[parsed.data.type];
    if (requiredPerm) {
      const canCreate = await hasPermission(user.id, activeOrg.id, requiredPerm);
      if (!canCreate) {
        return {
          success: false,
          error: `Forbidden: You do not have permission to create this item (${requiredPerm}).`,
        };
      }
    }

    const { data, error } = await supabase
      .from("company_entities")
      .insert({
        organization_id: activeOrg.id,
        type: parsed.data.type,
        title: parsed.data.title,
        content: parsed.data.content || "",
        metadata: parsed.data.metadata || {},
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !data) {
      logger.error("Failed to insert company entity", { error, orgId: activeOrg.id });
      return { success: false, error: error?.message || "Failed to create entity" };
    }

    // Record creation in entity_activity
    const actorName = user.user_metadata?.full_name || user.email || "Utilizador";
    await recordEntityActivity(supabase, {
      organizationId: activeOrg.id,
      entityId: data.id,
      actorId: user.id,
      actorName,
      action: "entity_created",
      changes: {
        title: { old: null, new: data.title },
        type: { old: null, new: data.type },
      },
    });

    // Revalidate paths corresponding to this entity
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${parsed.data.type}s`);
    revalidatePath("/dashboard/connections");
    revalidatePath("/dashboard/timeline");
    if (parsed.data.metadata?.due_date || parsed.data.metadata?.target_date) {
      revalidatePath("/dashboard/calendar");
    }

    return {
      success: true,
      entity: data as CompanyEntity,
    };
  } catch (err: unknown) {
    logger.error("Unexpected error in createCompanyEntityAction", err);
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Updates an existing company entity with audit logging of changed fields.
 */
export async function updateCompanyEntityAction(input: {
  id: string;
  title?: string;
  content?: string;
  notes?: string;
  status?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  dueDate?: string | null;
  targetDate?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  entity?: CompanyEntity;
  error?: string;
}> {
  try {
    const parsed = updateEntitySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input data",
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active workspace selected" };
    }

    // Ensure entity belongs to active organization
    const { data: existing } = await supabase
      .from("company_entities")
      .select("id, type, metadata, title, content")
      .eq("id", parsed.data.id)
      .eq("organization_id", activeOrg.id)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: "Entity not found in your workspace" };
    }

    // 1. Check edit permission for this entity type
    const requiredEditPerm = EDIT_PERMISSION_MAP[existing.type as CompanyEntityType];
    if (requiredEditPerm) {
      const canEdit = await hasPermission(user.id, activeOrg.id, requiredEditPerm);
      if (!canEdit) {
        return {
          success: false,
          error: `Forbidden: You do not have permission to edit ${existing.type} (${requiredEditPerm}).`,
        };
      }
    }

    // 2. If assigning a task, verify tasks.assign permission
    if (
      existing.type === "task" &&
      (parsed.data.assigneeId !== undefined || parsed.data.metadata?.assignee_id !== undefined)
    ) {
      const canAssign = await hasPermission(user.id, activeOrg.id, "tasks.assign");
      if (!canAssign) {
        return {
          success: false,
          error: "Forbidden: You do not have permission to assign tasks (tasks.assign).",
        };
      }
    }

    const currentMeta = (existing.metadata as Record<string, unknown>) || {};
    const updatedMetadata: Record<string, unknown> = {
      ...currentMeta,
      ...(parsed.data.metadata || {}),
    };

    // Calculate diff for audit log
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    let dominantAction: EntityActivityRecord["action"] = "details_updated";

    if (parsed.data.title !== undefined && parsed.data.title !== existing.title) {
      changes.title = { old: existing.title, new: parsed.data.title };
    }
    if (parsed.data.content !== undefined && parsed.data.content !== existing.content) {
      changes.content = { old: existing.content, new: parsed.data.content };
      dominantAction = "content_updated";
    }

    if (parsed.data.status !== undefined && parsed.data.status !== currentMeta.status) {
      changes.status = { old: currentMeta.status || null, new: parsed.data.status };
      updatedMetadata.status = parsed.data.status;
      dominantAction = "status_changed";
    }
    if (parsed.data.priority !== undefined && parsed.data.priority !== currentMeta.priority) {
      changes.priority = { old: currentMeta.priority || null, new: parsed.data.priority };
      updatedMetadata.priority = parsed.data.priority;
      dominantAction = "priority_changed";
    }
    if (parsed.data.notes !== undefined && parsed.data.notes !== currentMeta.notes) {
      changes.notes = { old: currentMeta.notes || null, new: parsed.data.notes };
      updatedMetadata.notes = parsed.data.notes;
    }
    if (parsed.data.dueDate !== undefined && parsed.data.dueDate !== currentMeta.due_date) {
      changes.due_date = { old: currentMeta.due_date || null, new: parsed.data.dueDate };
      updatedMetadata.due_date = parsed.data.dueDate;
      dominantAction = "due_date_changed";
    }
    if (parsed.data.targetDate !== undefined && parsed.data.targetDate !== currentMeta.target_date) {
      changes.target_date = { old: currentMeta.target_date || null, new: parsed.data.targetDate };
      updatedMetadata.target_date = parsed.data.targetDate;
      dominantAction = "due_date_changed";
    }
    if (parsed.data.assigneeId !== undefined && parsed.data.assigneeId !== currentMeta.assignee_id) {
      changes.assignee = {
        old: currentMeta.assignee_name || currentMeta.assignee_id || null,
        new: parsed.data.assigneeName || parsed.data.assigneeId || null,
      };
      updatedMetadata.assignee_id = parsed.data.assigneeId;
      dominantAction = "assignee_changed";
    }
    if (parsed.data.assigneeName !== undefined) {
      updatedMetadata.assignee_name = parsed.data.assigneeName;
    }

    const updatePayload: Record<string, unknown> = {
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.title !== undefined) updatePayload.title = parsed.data.title;
    if (parsed.data.content !== undefined) updatePayload.content = parsed.data.content;

    const { data, error } = await supabase
      .from("company_entities")
      .update(updatePayload)
      .eq("id", parsed.data.id)
      .eq("organization_id", activeOrg.id)
      .select()
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "Failed to update entity" };
    }

    // Record changes in entity_activity if any fields changed
    if (Object.keys(changes).length > 0) {
      const actorName = user.user_metadata?.full_name || user.email || "Utilizador";
      await recordEntityActivity(supabase, {
        organizationId: activeOrg.id,
        entityId: data.id,
        actorId: user.id,
        actorName,
        action: dominantAction,
        changes,
      });
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${existing.type}s`);
    revalidatePath("/dashboard/connections");
    revalidatePath("/dashboard/timeline");
    revalidatePath("/dashboard/calendar");

    return {
      success: true,
      entity: data as CompanyEntity,
    };
  } catch (err: unknown) {
    logger.error("Unexpected error in updateCompanyEntityAction", err);
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Toggles a task's completion status with permission check and audit log.
 */
export async function toggleTaskStatusAction(taskId: string): Promise<{
  success: boolean;
  completed?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };

    const canEdit = await hasPermission(user.id, activeOrg.id, "tasks.edit");
    if (!canEdit) {
      return { success: false, error: "Forbidden: You do not have permission to edit tasks." };
    }

    const { data: existing } = await supabase
      .from("company_entities")
      .select("id, metadata")
      .eq("id", taskId)
      .eq("organization_id", activeOrg.id)
      .eq("type", "task")
      .maybeSingle();

    if (!existing) {
      return { success: false, error: "Task not found" };
    }

    const currentMeta = (existing.metadata as Record<string, unknown>) || {};
    const isCompleted = currentMeta.status === "completed" || currentMeta.completed === true;
    const newStatus = isCompleted ? "in_progress" : "completed";

    const { error } = await supabase
      .from("company_entities")
      .update({
        metadata: {
          ...currentMeta,
          status: newStatus,
          completed: !isCompleted,
          completed_at: !isCompleted ? new Date().toISOString() : null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("organization_id", activeOrg.id);

    if (error) {
      return { success: false, error: error.message };
    }

    const actorName = user.user_metadata?.full_name || user.email || "Utilizador";
    await recordEntityActivity(supabase, {
      organizationId: activeOrg.id,
      entityId: taskId,
      actorId: user.id,
      actorName,
      action: "status_changed",
      changes: {
        status: { old: currentMeta.status || "todo", new: newStatus },
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/timeline");
    revalidatePath("/dashboard/calendar");

    return { success: true, completed: !isCompleted };
  } catch (err: unknown) {
    logger.error("Unexpected error in toggleTaskStatusAction", err);
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Schedules or connects an entity (task, meeting, goal) to a calendar date.
 */
export async function scheduleEntityOnCalendarAction(params: {
  entityId: string;
  date: string;
  time?: string;
  allDay?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };

    const { data: existing } = await supabase
      .from("company_entities")
      .select("id, type, metadata")
      .eq("id", params.entityId)
      .eq("organization_id", activeOrg.id)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: "Entity not found" };
    }

    const requiredEditPerm = EDIT_PERMISSION_MAP[existing.type as CompanyEntityType];
    if (requiredEditPerm) {
      const canEdit = await hasPermission(user.id, activeOrg.id, requiredEditPerm);
      if (!canEdit) {
        return { success: false, error: "Forbidden: Insufficient permissions to schedule this item." };
      }
    }

    // Compose ISO timestamp cleanly
    const isFullIso = params.date.includes("T");
    const combinedDate = isFullIso
      ? params.date
      : params.time
      ? `${params.date}T${params.time}:00.000Z`
      : `${params.date}T09:00:00.000Z`;

    const currentMeta = (existing.metadata as Record<string, unknown>) || {};
    const updatedMetadata: Record<string, unknown> = {
      ...currentMeta,
      all_day: params.allDay ?? !params.time,
    };

    let targetDateKey = "due_date";
    if (existing.type === "task") {
      updatedMetadata.due_date = combinedDate;
    } else if (existing.type === "goal") {
      targetDateKey = "target_date";
      updatedMetadata.target_date = combinedDate;
    } else if (existing.type === "meeting") {
      targetDateKey = "start_time";
      updatedMetadata.start_time = combinedDate;
      if (!currentMeta.end_time) {
        updatedMetadata.end_time = new Date(new Date(combinedDate).getTime() + 60 * 60 * 1000).toISOString();
      }
    }

    const { error } = await supabase
      .from("company_entities")
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.entityId)
      .eq("organization_id", activeOrg.id);

    if (error) {
      return { success: false, error: error.message };
    }

    const actorName = user.user_metadata?.full_name || user.email || "Utilizador";
    await recordEntityActivity(supabase, {
      organizationId: activeOrg.id,
      entityId: params.entityId,
      actorId: user.id,
      actorName,
      action: "due_date_changed",
      changes: {
        [targetDateKey]: { old: currentMeta[targetDateKey] || null, new: combinedDate },
      },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${existing.type}s`);
    revalidatePath("/dashboard/calendar");

    return { success: true };
  } catch (err: unknown) {
    logger.error("Unexpected error in scheduleEntityOnCalendarAction", err);
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Deletes a company entity with permission verification and cascading cleanup.
 */
export async function deleteCompanyEntityAction(entityId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };

    const { data: existing } = await supabase
      .from("company_entities")
      .select("id, type, title")
      .eq("id", entityId)
      .eq("organization_id", activeOrg.id)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: "Entity not found" };
    }

    const requiredDeletePerm = DELETE_PERMISSION_MAP[existing.type as CompanyEntityType];
    if (requiredDeletePerm) {
      const canDelete = await hasPermission(user.id, activeOrg.id, requiredDeletePerm);
      if (!canDelete) {
        return {
          success: false,
          error: `Forbidden: You do not have permission to delete ${existing.type} (${requiredDeletePerm}).`,
        };
      }
    }

    const { error } = await supabase
      .from("company_entities")
      .delete()
      .eq("id", entityId)
      .eq("organization_id", activeOrg.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${existing.type}s`);
    revalidatePath("/dashboard/connections");
    revalidatePath("/dashboard/timeline");
    revalidatePath("/dashboard/calendar");

    return { success: true };
  } catch (err: unknown) {
    logger.error("Unexpected error in deleteCompanyEntityAction", err);
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Retrieves chronological audit history for a specific entity.
 * Scoped strictly to the active organization with entity view permission.
 */
export async function getEntityActivityAction(
  entityId: string,
  limit: number = 30,
  offset: number = 0
): Promise<{
  success: boolean;
  activities?: EntityActivityRecord[];
  hasMore?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };

    // Find the entity first to check view permissions
    const { data: entity } = await supabase
      .from("company_entities")
      .select("id, type")
      .eq("id", entityId)
      .eq("organization_id", activeOrg.id)
      .maybeSingle();

    if (!entity) {
      return { success: false, error: "Entity not found" };
    }

    const requiredViewPerm = VIEW_PERMISSION_MAP[entity.type as CompanyEntityType];
    if (requiredViewPerm) {
      const canView = await hasPermission(user.id, activeOrg.id, requiredViewPerm);
      if (!canView) {
        return { success: false, error: "Forbidden: You do not have permission to view this item." };
      }
    }

    const boundedLimit = Math.min(Math.max(limit, 1), 100);

    const { data, error } = await supabase
      .from("entity_activity")
      .select("id, organization_id, entity_id, actor_id, actor_name, action, changes, metadata, created_at")
      .eq("organization_id", activeOrg.id)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .range(offset, offset + boundedLimit);

    if (error) {
      // Table may not have been migrated yet in test environments
      logger.warn("Could not retrieve entity_activity", { error });
      return { success: true, activities: [], hasMore: false };
    }

    const records = (data || []) as EntityActivityRecord[];
    const hasMore = records.length > boundedLimit;
    const activities = records.slice(0, boundedLimit);

    return {
      success: true,
      activities,
      hasMore,
    };
  } catch (err: unknown) {
    logger.error("Unexpected error in getEntityActivityAction", err);
    return { success: false, error: "Internal server error" };
  }
}
