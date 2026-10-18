// ==============================================================================
// Company Brain: Deterministic Graph Algorithms
// Zero AI - 100% Deterministic Traversal & Path Calculation
// ==============================================================================

import {
  GraphNode,
  GraphEdge,
  ShortestPathResult,
  ShortestPathStep,
  HierarchyTreeNode,
  EntityType,
} from "./types";

export interface AdjacencyMaps {
  outgoing: Map<string, Array<{ targetId: string; edge: GraphEdge }>>;
  incoming: Map<string, Array<{ sourceId: string; edge: GraphEdge }>>;
  undirected: Map<string, Array<{ neighborId: string; edge: GraphEdge }>>;
}

/**
 * Builds forward, reverse, and undirected adjacency lists in memory for fast traversal.
 */
export function buildAdjacencyList(
  nodes: GraphNode[],
  edges: GraphEdge[]
): AdjacencyMaps {
  const outgoing = new Map<string, Array<{ targetId: string; edge: GraphEdge }>>();
  const incoming = new Map<string, Array<{ sourceId: string; edge: GraphEdge }>>();
  const undirected = new Map<string, Array<{ neighborId: string; edge: GraphEdge }>>();

  for (const node of nodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
    undirected.set(node.id, []);
  }

  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    if (!undirected.has(edge.source)) undirected.set(edge.source, []);
    if (!undirected.has(edge.target)) undirected.set(edge.target, []);

    outgoing.get(edge.source)!.push({ targetId: edge.target, edge });
    incoming.get(edge.target)!.push({ sourceId: edge.source, edge });

    undirected.get(edge.source)!.push({ neighborId: edge.target, edge });
    undirected.get(edge.target)!.push({ neighborId: edge.source, edge });
  }

  return { outgoing, incoming, undirected };
}

/**
 * Retrieves the direct 1st-degree neighbors for a specific node.
 */
export function getDirectNeighbors(
  nodeId: string,
  edges: GraphEdge[]
): {
  incoming: GraphEdge[];
  outgoing: GraphEdge[];
  neighborIds: Set<string>;
} {
  const incoming: GraphEdge[] = [];
  const outgoing: GraphEdge[] = [];
  const neighborIds = new Set<string>();

  for (const edge of edges) {
    if (edge.source === nodeId) {
      outgoing.push(edge);
      neighborIds.add(edge.target);
    }
    if (edge.target === nodeId) {
      incoming.push(edge);
      neighborIds.add(edge.source);
    }
  }

  return { incoming, outgoing, neighborIds };
}

/**
 * Deterministic N-Hop Subgraph Traversal via Breadth-First Search (BFS).
 * Extracts nodes and edges reachable within `maxHops` from `startNodeId`.
 */
export function getNHopSubgraph(
  startNodeId: string,
  maxHops: number,
  allNodes: GraphNode[],
  allEdges: GraphEdge[]
): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  distances: Map<string, number>;
} {
  const nodeMap = new Map<string, GraphNode>();
  for (const node of allNodes) {
    nodeMap.set(node.id, node);
  }

  if (!nodeMap.has(startNodeId)) {
    return { nodes: [], edges: [], distances: new Map() };
  }

  const { undirected } = buildAdjacencyList(allNodes, allEdges);
  const distances = new Map<string, number>();
  const visitedNodes = new Set<string>();

  // Queue of [nodeId, currentDistance]
  const queue: Array<[string, number]> = [[startNodeId, 0]];
  visitedNodes.add(startNodeId);
  distances.set(startNodeId, 0);

  while (queue.length > 0) {
    const [currentId, currentDist] = queue.shift()!;

    if (currentDist >= maxHops) {
      continue;
    }

    const neighbors = undirected.get(currentId) || [];
    for (const { neighborId } of neighbors) {
      if (!visitedNodes.has(neighborId)) {
        visitedNodes.add(neighborId);
        distances.set(neighborId, currentDist + 1);
        queue.push([neighborId, currentDist + 1]);
      }
    }
  }

  const subgraphNodes = Array.from(visitedNodes)
    .map((id) => nodeMap.get(id)!)
    .filter(Boolean);

  const subgraphEdges = allEdges.filter(
    (edge) => visitedNodes.has(edge.source) && visitedNodes.has(edge.target)
  );

  return {
    nodes: subgraphNodes,
    edges: subgraphEdges,
    distances,
  };
}

/**
 * Deterministic Shortest Path between two nodes using Breadth-First Search (BFS).
 * Explores relationships in both directions to discover semantic connection trails.
 */
export function findShortestPathBFS(
  startNodeId: string,
  targetNodeId: string,
  allNodes: GraphNode[],
  allEdges: GraphEdge[]
): ShortestPathResult {
  if (startNodeId === targetNodeId) {
    const startNode = allNodes.find((n) => n.id === startNodeId);
    if (!startNode) return { found: false, path: [], totalHops: 0 };
    return {
      found: true,
      path: [{ node: startNode }],
      totalHops: 0,
    };
  }

  const nodeMap = new Map<string, GraphNode>();
  for (const node of allNodes) {
    nodeMap.set(node.id, node);
  }

  if (!nodeMap.has(startNodeId) || !nodeMap.has(targetNodeId)) {
    return { found: false, path: [], totalHops: 0 };
  }

  const { undirected } = buildAdjacencyList(allNodes, allEdges);
  const visited = new Set<string>();
  const cameFrom = new Map<string, { prevId: string; edge: GraphEdge; direction: "forward" | "reverse" }>();

  const queue: string[] = [startNodeId];
  visited.add(startNodeId);
  let head = 0;

  while (head < queue.length) {
    const currentId = queue[head++];

    // Sort neighbors deterministically by neighborId, then edge id
    const neighbors = [...(undirected.get(currentId) || [])].sort((a, b) =>
      a.neighborId.localeCompare(b.neighborId) || a.edge.id.localeCompare(b.edge.id)
    );

    for (const { neighborId, edge } of neighbors) {
      if (visited.has(neighborId)) continue;

      const direction: "forward" | "reverse" = edge.source === currentId ? "forward" : "reverse";
      visited.add(neighborId);
      cameFrom.set(neighborId, { prevId: currentId, edge, direction });

      if (neighborId === targetNodeId) {
        // Reconstruct path from target to start in O(path_length)
        const path: ShortestPathStep[] = [];
        let curr = targetNodeId;

        while (curr !== startNodeId) {
          const stepInfo = cameFrom.get(curr)!;
          const node = nodeMap.get(curr)!;
          path.unshift({ node, edge: stepInfo.edge, direction: stepInfo.direction });
          curr = stepInfo.prevId;
        }

        path.unshift({ node: nodeMap.get(startNodeId)! });

        return {
          found: true,
          path,
          totalHops: path.length - 1,
        };
      }

      queue.push(neighborId);
    }
  }

  return { found: false, path: [], totalHops: 0 };
}

export const findShortestPath = findShortestPathBFS;

/**
 * Constructs the hierarchical tree view from Pages parent/child structure and entity containment.
 */
export function buildCompanyHierarchyTree(
  pages: Array<{ id: string; title: string; icon?: string | null; parent_page_id?: string | null }>,
  entities: Array<{ id: string; title: string; type: EntityType }>,
  edges: GraphEdge[]
): HierarchyTreeNode[] {
  const treeNodeMap = new Map<string, HierarchyTreeNode>();
  const rootNodes: HierarchyTreeNode[] = [];

  // Compute connections count per object
  const connectionCounts = new Map<string, number>();
  for (const edge of edges) {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
  }

  // 1. Initialize Page Tree Nodes
  for (const page of pages) {
    treeNodeMap.set(page.id, {
      id: page.id,
      title: page.title || "Untitled",
      type: "page",
      icon: page.icon || "📄",
      children: [],
      connectionCount: connectionCounts.get(page.id) || 0,
    });
  }

  // 2. Link Page Parent-Child relationships
  for (const page of pages) {
    const node = treeNodeMap.get(page.id);
    if (!node) continue;

    if (page.parent_page_id && treeNodeMap.has(page.parent_page_id)) {
      treeNodeMap.get(page.parent_page_id)!.children.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  // 3. Attach entities that are "part_of" a page or project
  const partOfEdges = edges.filter((e) => e.relationshipType === "part_of");
  const attachedEntityIds = new Set<string>();

  for (const edge of partOfEdges) {
    const parentNode = treeNodeMap.get(edge.target);
    const entity = entities.find((e) => e.id === edge.source);
    if (parentNode && entity && !attachedEntityIds.has(entity.id)) {
      parentNode.children.push({
        id: entity.id,
        title: entity.title,
        type: entity.type,
        children: [],
        connectionCount: connectionCounts.get(entity.id) || 0,
      });
      attachedEntityIds.add(entity.id);
    }
  }

  // 4. Group any unparented entities into dedicated categorized virtual roots
  const unattachedEntities = entities.filter((e) => !attachedEntityIds.has(e.id));
  if (unattachedEntities.length > 0) {
    const categories: Partial<Record<EntityType, HierarchyTreeNode[]>> = {};

    for (const ent of unattachedEntities) {
      if (!categories[ent.type]) {
        categories[ent.type] = [];
      }
      categories[ent.type]!.push({
        id: ent.id,
        title: ent.title,
        type: ent.type,
        children: [],
        connectionCount: connectionCounts.get(ent.id) || 0,
      });
    }

    for (const [type, items] of Object.entries(categories)) {
      rootNodes.push({
        id: `virtual-${type}`,
        title: `${type.toUpperCase()}S`,
        type: type as EntityType,
        children: items || [],
        connectionCount: (items || []).reduce((acc, i) => acc + i.connectionCount, 0),
      });
    }
  }

  return rootNodes;
}

/**
 * Computes deterministic spatial coordinates for graph nodes.
 * Groups connected components into coherent radial clusters and places
 * isolated/disconnected nodes along an organized outer ring/grid.
 */
export function computeDeterministicGraphLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width = 1000,
  height = 700
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // Build undirected adjacency
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source)!.add(e.target);
      adj.get(e.target)!.add(e.source);
    }
  }

  // Find connected components via BFS
  const visited = new Set<string>();
  const components: Array<GraphNode[]> = [];

  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const comp: GraphNode[] = [];
    const queue: string[] = [node.id];
    visited.add(node.id);
    let head = 0;

    while (head < queue.length) {
      const currId = queue[head++];
      const currNode = nodeMap.get(currId);
      if (currNode) comp.push(currNode);

      for (const neighborId of adj.get(currId) || []) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }
    components.push(comp);
  }

  // Separate connected clusters (size > 1) and isolated nodes (size == 1)
  const connectedClusters = components.filter((c) => c.length > 1);
  const isolatedNodes = components.filter((c) => c.length === 1).map((c) => c[0]);

  const centerX = width / 2;
  const centerY = height / 2;

  // Position connected clusters
  if (connectedClusters.length === 1) {
    // Single main cluster at center
    const cluster = connectedClusters[0];
    // Find node with highest degree as cluster center
    const sorted = [...cluster].sort((a, b) => (b.degree || 0) - (a.degree || 0));
    const centerNode = sorted[0];
    positions.set(centerNode.id, { x: centerX, y: centerY });

    const others = sorted.slice(1);
    for (let i = 0; i < others.length; i++) {
      const angle = (i / Math.max(1, others.length)) * Math.PI * 2;
      const radius = 120 + Math.floor(i / 8) * 85;
      positions.set(others[i].id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
    }
  } else if (connectedClusters.length > 1) {
    // Multiple connected clusters: place each around center
    const clusterDist = Math.min(width, height) * 0.32;
    for (let cIdx = 0; cIdx < connectedClusters.length; cIdx++) {
      const cluster = connectedClusters[cIdx];
      const clusterAngle = (cIdx / connectedClusters.length) * Math.PI * 2;
      const clusterX = centerX + Math.cos(clusterAngle) * clusterDist;
      const clusterY = centerY + Math.sin(clusterAngle) * clusterDist;

      const sorted = [...cluster].sort((a, b) => (b.degree || 0) - (a.degree || 0));
      const hubNode = sorted[0];
      positions.set(hubNode.id, { x: clusterX, y: clusterY });

      const members = sorted.slice(1);
      for (let i = 0; i < members.length; i++) {
        const angle = (i / Math.max(1, members.length)) * Math.PI * 2;
        const radius = 65 + (i % 2) * 35;
        positions.set(members[i].id, {
          x: clusterX + Math.cos(angle) * radius,
          y: clusterY + Math.sin(angle) * radius,
        });
      }
    }
  }

  // Position isolated nodes in an organized outer orbit
  if (isolatedNodes.length > 0) {
    const hasClusters = connectedClusters.length > 0;
    const baseRadius = hasClusters ? Math.min(width, height) * 0.44 + 40 : 130;

    for (let i = 0; i < isolatedNodes.length; i++) {
      const angle = (i / isolatedNodes.length) * Math.PI * 2 - Math.PI / 2;
      const ring = Math.floor(i / 16);
      const r = baseRadius + ring * 65;
      positions.set(isolatedNodes[i].id, {
        x: centerX + Math.cos(angle) * r,
        y: centerY + Math.sin(angle) * r,
      });
    }
  }

  return positions;
}
