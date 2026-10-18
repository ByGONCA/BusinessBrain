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

      // Parallel batch query for performance.
      const [pagesRes, entitiesRes, connectionsRes, legacyBlockRes] = await Promise.all([
        supabase
          .from("pages")
          .select("id, title, icon, parent_page_id, created_at, organization_id")
          .eq("organization_id", organizationId)
          .eq("is_archived", false)
          .limit(1000),
        supabase
          .from("company_entities")
          .select("id, type, title, metadata, created_at, organization_id")
          .eq("organization_id", organizationId)
          .limit(1000),
        supabase
          .from("company_connections")
          .select("id, source_id, source_type, source_title, target_id, target_type, target_title, relationship_type, metadata, created_by, created_at, updated_at")
          .eq("organization_id", organizationId)
          .limit(2000),
        supabase
          .from("page_connections")
          .select("source_id, page_id")
          .eq("organization_id", organizationId)
          .limit(2000),
      ]);

      const pages = pagesRes.data || [];
      const entities = entitiesRes.data || [];
      let connections = (connectionsRes.data || []) as CompanyConnectionRecord[];
      const blockToPageMap = new Map<string, string>();
      for (const row of legacyBlockRes.data || []) {
        if (row.source_id && row.page_id) {
          blockToPageMap.set(row.source_id, row.page_id);
        }
      }

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

      // Sanitize icon to ensure zero image/base64 payloads enter GraphNode
      const sanitizeGraphIcon = (icon?: string | null, fallback = "📄"): string => {
        if (!icon) return fallback;
        if (
          icon.startsWith("data:image/") ||
          icon.startsWith("http://") ||
          icon.startsWith("https://") ||
          icon.startsWith("blob:") ||
          icon.length > 8
        ) {
          return fallback;
        }
        return icon;
      };

      // Transform Pages to GraphNodes
      const pageNodes: GraphNode[] = pages.map((p) => {
        const isDraft =
          !p.title || p.title.trim() === "" || p.title.trim() === "Untitled";

        return {
          id: p.id,
          type: "page",
          title: p.title?.trim() || "Untitled Page",
          icon: sanitizeGraphIcon(p.icon, "📄"),
          organization_id: p.organization_id,
          degree: 0,
          inDegree: 0,
          outDegree: 0,
          isDraft,
          parentId: p.parent_page_id || null,
        };
      });

      // Transform Company Entities to GraphNodes
      const entityNodes: GraphNode[] = entities.map((e) => {
        return {
          id: e.id,
          type: e.type as EntityType,
          title: e.title?.trim() || "Untitled Entity",
          metadata: e.metadata || {},
          organization_id: e.organization_id,
          degree: 0,
          inDegree: 0,
          outDegree: 0,
          isDraft: false,
        };
      });

      const allNodes = [...pageNodes, ...entityNodes];
      const validNodeIds = new Set(allNodes.map((n) => n.id));
      const pageNodeIdSet = new Set(pageNodes.map((n) => n.id));

      const edgeDedupeSet = new Set<string>();
      const edges: GraphEdge[] = [];

      const addEdge = (edge: GraphEdge) => {
        if (!edge.source || !edge.target || edge.source === edge.target) return;
        const key = `${edge.source}->${edge.target}:${edge.relationshipType}`;
        if (edgeDedupeSet.has(key)) return;
        edgeDedupeSet.add(key);
        edges.push(edge);
      };

      // 1. Structural Parent-Child Page Edges (Deterministic from public.pages)
      for (const p of pages) {
        if (p.parent_page_id && pageNodeIdSet.has(p.parent_page_id) && p.id !== p.parent_page_id) {
          const cfg = RELATIONSHIP_LABELS.part_of;
          addEdge({
            id: `structural-page-${p.id}-${p.parent_page_id}`,
            source: p.id,
            sourceType: "page",
            target: p.parent_page_id,
            targetType: "page",
            relationshipType: "part_of",
            label: cfg.forward,
            reverseLabel: cfg.reverse,
            metadata: { is_structural: true },
            isStructural: true,
          });
        }
      }

      // 2. Canonical Company Connections (with block resolution)
      for (const conn of connections) {
        let actualSourceId = conn.source_id;
        let actualSourceType = conn.source_type;

        // If source is a block, resolve to containing page
        if (conn.source_type === "block") {
          const mappedPageId =
            (conn.metadata?.page_id as string) || blockToPageMap.get(conn.source_id);
          if (mappedPageId && validNodeIds.has(mappedPageId)) {
            actualSourceId = mappedPageId;
            actualSourceType = "page";
          }
        }

        const sourceExists = validNodeIds.has(actualSourceId);
        const targetExists = validNodeIds.has(conn.target_id);

        if (sourceExists && targetExists) {
          const cfg = RELATIONSHIP_LABELS[conn.relationship_type] || RELATIONSHIP_LABELS.related_to;
          addEdge({
            id: conn.id,
            source: actualSourceId,
            sourceType: actualSourceType,
            target: conn.target_id,
            targetType: conn.target_type,
            relationshipType: conn.relationship_type,
            label: cfg.forward,
            reverseLabel: cfg.reverse,
            metadata: conn.metadata,
          });
        }
      }

      // 3. Recalculate node degrees and isolation status accurately
      const inDegreeMap = new Map<string, number>();
      const outDegreeMap = new Map<string, number>();

      for (const edge of edges) {
        outDegreeMap.set(edge.source, (outDegreeMap.get(edge.source) || 0) + 1);
        inDegreeMap.set(edge.target, (inDegreeMap.get(edge.target) || 0) + 1);
      }

      for (const node of allNodes) {
        const inDeg = inDegreeMap.get(node.id) || 0;
        const outDeg = outDegreeMap.get(node.id) || 0;
        node.inDegree = inDeg;
        node.outDegree = outDeg;
        node.degree = inDeg + outDeg;
        node.isIsolated = node.degree === 0;
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
