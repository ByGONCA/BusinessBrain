"use server";

// ==============================================================================
// Company Brain: Company Connections Server Actions
// Strict Organization Scoping & Zero Secret Leakage
// ==============================================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { isValidUuid } from "@/lib/security/authorization";
import { logger } from "@/lib/security/logger";
import {
  CompanyConnectionRecord,
  CompanyGraphData,
  RelationshipType,
  RELATIONSHIP_TYPES,
  EntityType,
  ShortestPathResult,
} from "./types";
import { getCompanyGraphData } from "./queries";
import { findShortestPathBFS } from "./graph-algorithms";
import { hasPermission } from "@/lib/permissions/resolver";

/**
 * Creates a directed connection between any two company objects.
 */
export async function createConnectionAction(params: {
  sourceType: EntityType | "block";
  sourceId: string;
  sourceTitle: string;
  targetType: EntityType | "block";
  targetId: string;
  targetTitle: string;
  relationshipType: RelationshipType;
  metadata?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  connection?: CompanyConnectionRecord;
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
      return { success: false, error: "No active workspace found" };
    }

    // Verify permission: requires brain.create or brain.manage
    const canCreate =
      (await hasPermission(user.id, activeOrg.id, "brain.create")) ||
      (await hasPermission(user.id, activeOrg.id, "brain.manage"));
    if (!canCreate) {
      return { success: false, error: "Forbidden: You do not have permission to record decisions or create knowledge graph connections." };
    }

    // Validation: prevent self-connections
    if (params.sourceId === params.targetId) {
      return { success: false, error: "An object cannot be connected to itself" };
    }

    // Validation: check relationship type
    if (!RELATIONSHIP_TYPES.includes(params.relationshipType)) {
      return { success: false, error: "Invalid relationship type" };
    }

    // Cross-tenant validation: verify source and target belong to the active organization
    // Only validate well-formed UUIDs (block IDs may be short/custom)
    const entityTables: Record<string, string> = {
      page: "pages",
      company_entity: "company_entities",
      person: "company_entities",
      project: "company_entities",
      task: "company_entities",
      decision: "company_entities",
      goal: "company_entities",
      meeting: "company_entities",
      document: "company_entities",
    };
    const sourceTable = entityTables[params.sourceType];
    const targetTable = entityTables[params.targetType];

    if (sourceTable && isValidUuid(params.sourceId)) {
      const { data: srcObj } = await supabase
        .from(sourceTable as "pages" | "company_entities")
        .select("id")
        .eq("id", params.sourceId)
        .eq("organization_id", activeOrg.id)
        .maybeSingle();
      if (!srcObj) {
        return { success: false, error: "Source object not found in your workspace" };
      }
    }

    if (targetTable && isValidUuid(params.targetId)) {
      const { data: tgtObj } = await supabase
        .from(targetTable as "pages" | "company_entities")
        .select("id")
        .eq("id", params.targetId)
        .eq("organization_id", activeOrg.id)
        .maybeSingle();
      if (!tgtObj) {
        return { success: false, error: "Target object not found in your workspace" };
      }
    }

    // Check if an identical connection already exists
    const { data: existingSameConn } = await supabase
      .from("company_connections")
      .select("id")
      .eq("organization_id", activeOrg.id)
      .eq("source_id", params.sourceId)
      .eq("target_id", params.targetId)
      .eq("relationship_type", params.relationshipType)
      .maybeSingle();

    if (existingSameConn) {
      return {
        success: false,
        error: "Esta relação exata já existe entre estes dois elementos no grafo.",
      };
    }

    // Check if a structural hierarchy already fulfills part_of for pages
    if (params.sourceType === "page" && params.targetType === "page" && params.relationshipType === "part_of") {
      const { data: pageRow } = await supabase
        .from("pages")
        .select("parent_page_id")
        .eq("id", params.sourceId)
        .eq("organization_id", activeOrg.id)
        .maybeSingle();
      if (pageRow?.parent_page_id === params.targetId) {
        return {
          success: false,
          error: "Esta ligação já existe como relação hierárquica estrutural entre subpágina e página-mãe.",
        };
      }
    }

    const cleanSourceTitle = params.sourceTitle.trim() || "Source";
    const cleanTargetTitle = params.targetTitle.trim() || "Target";

    // Insert into canonical company_connections table
    const { data, error } = await supabase
      .from("company_connections")
      .insert({
        organization_id: activeOrg.id,
        source_type: params.sourceType,
        source_id: params.sourceId,
        source_title: cleanSourceTitle,
        target_type: params.targetType,
        target_id: params.targetId,
        target_title: cleanTargetTitle,
        relationship_type: params.relationshipType,
        metadata: params.metadata || {},
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      // Fallback: If table not created yet, log and try page_connections if page-related
      logger.error("Error creating company connection", { error });
      return { success: false, error: error.message || "Failed to create connection" };
    }

    revalidatePath("/dashboard/connections");
    revalidatePath("/dashboard/pages");

    return {
      success: true,
      connection: data as CompanyConnectionRecord,
    };
  } catch (err: unknown) {
    logger.error("Unexpected error in createConnectionAction", err);
    return { success: false, error: "Unexpected error creating connection" };
  }
}

/**
 * Removes an existing connection reference.
 * Strictly deletes only the relationship record; source and target objects remain intact.
 */
export async function removeConnectionAction(connectionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!isValidUuid(connectionId)) {
      return { success: false, error: "Invalid connection ID" };
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
      return { success: false, error: "No active workspace found" };
    }

    // Verify permission: requires brain.manage
    const canManage = await hasPermission(user.id, activeOrg.id, "brain.manage");
    if (!canManage) {
      return { success: false, error: "Forbidden: You do not have permission to manage knowledge graph connections." };
    }

    // 1. Try deleting from company_connections
    const { error: deleteError } = await supabase
      .from("company_connections")
      .delete()
      .eq("id", connectionId)
      .eq("organization_id", activeOrg.id);

    // 2. Also attempt legacy page_connections cleanup if applicable
    await supabase
      .from("page_connections")
      .delete()
      .eq("id", connectionId)
      .eq("organization_id", activeOrg.id);

    if (deleteError && deleteError.code !== "PGRST205") {
      logger.error("Error removing connection", { error: deleteError });
      return { success: false, error: "Failed to remove connection" };
    }

    revalidatePath("/dashboard/connections");
    revalidatePath("/dashboard/pages");

    return { success: true };
  } catch (err: unknown) {
    logger.error("Unexpected error in removeConnectionAction", err);
    return { success: false, error: "Failed to remove connection" };
  }
}

/**
 * Client-callable action to refresh or fetch live company graph data.
 */
export async function getCompanyGraphAction(): Promise<{
  success: boolean;
  graph?: CompanyGraphData;
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
      return { success: false, error: "No active workspace found" };
    }

    const canView = await hasPermission(user.id, activeOrg.id, "brain.view");
    if (!canView) {
      return { success: false, error: "Forbidden: You do not have permission to view Company Brain." };
    }

    const graph = await getCompanyGraphData(activeOrg.id);
    return { success: true, graph };
  } catch (err: unknown) {
    logger.error("Unexpected error in getCompanyGraphAction", err);
    return { success: false, error: "Failed to retrieve company graph" };
  }
}

/**
 * Deterministic BFS Shortest Path finder server action.
 */
export async function findShortestPathAction(
  startNodeId: string,
  targetNodeId: string
): Promise<ShortestPathResult> {
  try {
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { found: false, path: [], totalHops: 0 };
    }

    const graph = await getCompanyGraphData(activeOrg.id);
    return findShortestPathBFS(startNodeId, targetNodeId, graph.nodes, graph.edges);
  } catch (err: unknown) {
    logger.error("Unexpected error in findShortestPathAction", err);
    return { found: false, path: [], totalHops: 0 };
  }
}

/**
 * Updates an existing company connection metadata or description.
 * Enforces brain.edit permission.
 */
export async function updateConnectionAction(params: {
  connectionId: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidUuid(params.connectionId)) {
      return { success: false, error: "Invalid connection ID" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace found" };

    const canEditBrain = await hasPermission(user.id, activeOrg.id, "brain.edit");
    if (!canEditBrain) {
      return { success: false, error: "Forbidden: You do not have permission to edit Brain connections." };
    }

    const { error } = await supabase
      .from("company_connections")
      .update({
        metadata: params.metadata || {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.connectionId)
      .eq("organization_id", activeOrg.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/connections");
    return { success: true };
  } catch (err: unknown) {
    logger.error("Error updating connection", err);
    return { success: false, error: "Failed to update connection" };
  }
}
