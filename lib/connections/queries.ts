// ==============================================================================
// Company Brain: Company Connections Database Queries
// Server-side Cached & Organization-Scoped
// ==============================================================================

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isValidUuid } from "@/lib/security/authorization";
import { logger } from "@/lib/security/logger";
import {
  CompanyGraphData,
  GraphNode,
  GraphEdge,
  CompanyConnectionRecord,
  RELATIONSHIP_LABELS,
  RelationshipType,
  EntityType,
} from "./types";

/**
 * Retrieves the complete deterministic company graph for an organization.
 * Combines pages, company entities, and connections into a unified graph.
 */
export const getCompanyGraphData = cache(
  async (organizationId: string): Promise<CompanyGraphData> => {
    if (!isValidUuid(organizationId)) {
      return { nodes: [], edges: [], totalConnections: 0 };
    }

    try {
      const supabase = await createClient();

      // Parallel batch query for performance
      const [pagesRes, entitiesRes, connectionsRes] = await Promise.all([
        supabase
          .from("pages")
          .select("id, title, icon, created_at, organization_id")
          .eq("organization_id", organizationId)
          .eq("is_archived", false),
        supabase
          .from("company_entities")
          .select("id, type, title, metadata, created_at, organization_id")
          .eq("organization_id", organizationId),
        supabase
          .from("company_connections")
          .select("*")
          .eq("organization_id", organizationId),
      ]);

      const pages = pagesRes.data || [];
      const entities = entitiesRes.data || [];
      let connections = (connectionsRes.data || []) as CompanyConnectionRecord[];

      // Fallback: If company_connections table is not created yet or empty, check page_connections
      if (connections.length === 0 && connectionsRes.error?.code === "PGRST205") {
        const legacyRes = await supabase
          .from("page_connections")
          .select("*")
          .eq("organization_id", organizationId);

        if (legacyRes.data && legacyRes.data.length > 0) {
          connections = legacyRes.data.map((pc: any) => ({
            id: pc.id,
            organization_id: pc.organization_id,
            source_type: pc.source_type,
            source_id: pc.source_id,
            source_title: pc.metadata?.source_title || "Page",
            target_type: pc.target_type,
            target_id: pc.target_id,
            target_title: pc.target_title,
            relationship_type: (pc.metadata?.relationship_type as RelationshipType) || "related_to",
            metadata: pc.metadata || {},
            created_by: pc.created_by,
            created_at: pc.created_at,
            updated_at: pc.updated_at,
          }));
        }
      }

      // Count node in/out degrees
      const inDegreeMap = new Map<string, number>();
      const outDegreeMap = new Map<string, number>();

      for (const conn of connections) {
        outDegreeMap.set(conn.source_id, (outDegreeMap.get(conn.source_id) || 0) + 1);
        inDegreeMap.set(conn.target_id, (inDegreeMap.get(conn.target_id) || 0) + 1);
      }

      // Transform Pages to GraphNodes
      const pageNodes: GraphNode[] = pages.map((p) => {
        const inDeg = inDegreeMap.get(p.id) || 0;
        const outDeg = outDegreeMap.get(p.id) || 0;
        return {
          id: p.id,
          type: "page",
          title: p.title || "Untitled Page",
          icon: p.icon || "📄",
          organization_id: p.organization_id,
          degree: inDeg + outDeg,
          inDegree: inDeg,
          outDegree: outDeg,
        };
      });

      // Transform Company Entities to GraphNodes
      const entityNodes: GraphNode[] = entities.map((e) => {
        const inDeg = inDegreeMap.get(e.id) || 0;
        const outDeg = outDegreeMap.get(e.id) || 0;
        return {
          id: e.id,
          type: e.type as EntityType,
          title: e.title,
          metadata: e.metadata || {},
          organization_id: e.organization_id,
          degree: inDeg + outDeg,
          inDegree: inDeg,
          outDegree: outDeg,
        };
      });

      const allNodes = [...pageNodes, ...entityNodes];
      const validNodeIds = new Set(allNodes.map((n) => n.id));

      // Filter and map edges (ensure both endpoints exist in the active org)
      const edges: GraphEdge[] = [];
      for (const conn of connections) {
        // Source could be block or page or entity. If block, resolve to page if needed.
        const sourceExists = validNodeIds.has(conn.source_id);
        const targetExists = validNodeIds.has(conn.target_id);

        if (sourceExists && targetExists) {
          const cfg = RELATIONSHIP_LABELS[conn.relationship_type] || RELATIONSHIP_LABELS.related_to;
          edges.push({
            id: conn.id,
            source: conn.source_id,
            sourceType: conn.source_type,
            target: conn.target_id,
            targetType: conn.target_type,
            relationshipType: conn.relationship_type,
            label: cfg.forward,
            reverseLabel: cfg.reverse,
            metadata: conn.metadata,
          });
        }
      }

      return {
        nodes: allNodes,
        edges,
        totalConnections: edges.length,
      };
    } catch (err: unknown) {
      logger.error("Unexpected error in getCompanyGraphData", err, { organizationId });
      return { nodes: [], edges: [], totalConnections: 0 };
    }
  }
);

/**
 * Searches active pages and entities within an organization.
 */
export async function searchCompanyNodes(
  organizationId: string,
  searchTerm: string
): Promise<Array<{ id: string; title: string; type: EntityType; icon?: string }>> {
  if (!isValidUuid(organizationId) || !searchTerm.trim()) {
    return [];
  }

  const cleanTerm = searchTerm.trim().toLowerCase();
  const graph = await getCompanyGraphData(organizationId);

  return graph.nodes
    .filter((node) => node.title.toLowerCase().includes(cleanTerm))
    .slice(0, 25)
    .map((n) => ({
      id: n.id,
      title: n.title,
      type: n.type,
      icon: n.icon,
    }));
}
