// ==============================================================================
// Verification Test Suite: Company Graph Engine
// Tests structural edges, deduplication, BFS pathfinder, and deterministic layout
// ==============================================================================

import {
  findShortestPath,
  getNHopSubgraph,
  buildAdjacencyList,
  computeDeterministicGraphLayout,
  buildCompanyHierarchyTree,
} from "../lib/connections/graph-algorithms";
import { GraphNode, GraphEdge, EntityType } from "../lib/connections/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log("\n🧪 Running Company Graph Deterministic Engine Tests...\n");

  // 1. Mock Nodes
  const rootPage: GraphNode = {
    id: "page-root",
    organization_id: "org-1",
    title: "Company Handbook",
    type: "page",
    degree: 0,
    inDegree: 0,
    outDegree: 0,
    isIsolated: false,
    isDraft: false,
  };

  const childPage1: GraphNode = {
    id: "page-eng",
    organization_id: "org-1",
    title: "Engineering Team",
    type: "page",
    degree: 0,
    inDegree: 0,
    outDegree: 0,
    isIsolated: false,
    isDraft: false,
    parentId: "page-root",
  };

  const childPage2: GraphNode = {
    id: "page-design",
    organization_id: "org-1",
    title: "Design Guidelines",
    type: "page",
    degree: 0,
    inDegree: 0,
    outDegree: 0,
    isIsolated: false,
    isDraft: false,
    parentId: "page-root",
  };

  const projectNode: GraphNode = {
    id: "proj-1",
    organization_id: "org-1",
    title: "Q4 Redesign",
    type: "project",
    degree: 0,
    inDegree: 0,
    outDegree: 0,
    isIsolated: false,
    isDraft: false,
  };

  const isolatedDraft: GraphNode = {
    id: "page-scratch",
    organization_id: "org-1",
    title: "Untitled",
    type: "page",
    degree: 0,
    inDegree: 0,
    outDegree: 0,
    isIsolated: true,
    isDraft: true,
  };

  // 2. Synthesize structural edges as done in getCompanyGraphData
  const mockPages = [
    { id: "page-root", title: "Company Handbook", parent_page_id: null, content_text: "Welcome" },
    { id: "page-eng", title: "Engineering Team", parent_page_id: "page-root", content_text: "Coding rules" },
    { id: "page-design", title: "Design Guidelines", parent_page_id: "page-root", content_text: "Design tokens" },
    { id: "page-scratch", title: "Untitled", parent_page_id: null, content_text: null },
  ];

  const structuralEdges: GraphEdge[] = [];
  const validNodeIds = new Set(["page-root", "page-eng", "page-design", "proj-1", "page-scratch"]);

  for (const p of mockPages) {
    if (p.parent_page_id && validNodeIds.has(p.parent_page_id) && p.parent_page_id !== p.id) {
      structuralEdges.push({
        id: `structural-${p.id}-${p.parent_page_id}`,
        source: p.id,
        sourceType: "page",
        target: p.parent_page_id,
        targetType: "page",
        relationshipType: "part_of",
        label: "Subpágina de",
        reverseLabel: "Contém subpágina",
        isStructural: true,
      });
    }
  }

  assert(structuralEdges.length === 2, "Synthesizes 2 structural edges from parent_page_id");
  assert(structuralEdges[0].source === "page-eng" && structuralEdges[0].target === "page-root", "Child page correctly targets parent");

  // 3. Explicit typed edge (e.g. Engineering blocks Q4 Redesign)
  const explicitEdge: GraphEdge = {
    id: "conn-1",
    source: "page-eng",
    sourceType: "page",
    target: "proj-1",
    targetType: "project",
    relationshipType: "blocks",
    label: "Blocks",
    reverseLabel: "Blocked by",
    isStructural: false,
  };

  const allEdges = [...structuralEdges, explicitEdge];

  // 4. Test Edge Deduplication
  const duplicateEdge: GraphEdge = {
    id: "conn-1-dup",
    source: "page-eng",
    sourceType: "page",
    target: "proj-1",
    targetType: "project",
    relationshipType: "blocks",
    label: "Blocks",
    reverseLabel: "Blocked by",
  };

  const dedupeSet = new Set<string>();
  const dedupedEdges: GraphEdge[] = [];
  for (const e of [...allEdges, duplicateEdge]) {
    const key = `${e.source}->${e.target}:${e.relationshipType}`;
    if (!dedupeSet.has(key)) {
      dedupeSet.add(key);
      dedupedEdges.push(e);
    }
  }

  assert(dedupedEdges.length === 3, "Deterministic deduplication eliminates duplicate edges");

  // 5. Degree calculation test
  const allNodes = [rootPage, childPage1, childPage2, projectNode, isolatedDraft];
  const inDegreeMap = new Map<string, number>();
  const outDegreeMap = new Map<string, number>();

  for (const e of dedupedEdges) {
    outDegreeMap.set(e.source, (outDegreeMap.get(e.source) || 0) + 1);
    inDegreeMap.set(e.target, (inDegreeMap.get(e.target) || 0) + 1);
  }

  for (const n of allNodes) {
    n.inDegree = inDegreeMap.get(n.id) || 0;
    n.outDegree = outDegreeMap.get(n.id) || 0;
    n.degree = n.inDegree + n.outDegree;
    n.isIsolated = n.degree === 0;
  }

  assert(rootPage.degree === 2 && rootPage.inDegree === 2, "Root page has 2 incoming structural edges");
  assert(childPage1.degree === 2 && childPage1.outDegree === 2, "Eng page has 2 outgoing edges (parent + project)");
  assert(isolatedDraft.isIsolated === true && isolatedDraft.degree === 0, "Draft page is detected as isolated");

  // 6. Test BFS Shortest Path
  const pathResult = findShortestPath("page-design", "proj-1", allNodes, dedupedEdges);
  assert(pathResult.found === true, "BFS finds path across structural and explicit relations");
  assert(pathResult.totalHops === 3, "Shortest path is 3 hops: design -> root -> eng -> proj-1");

  // 7. Test N-Hop Subgraph
  const sub1 = getNHopSubgraph("page-root", 1, allNodes, dedupedEdges);
  assert(sub1.nodes.length === 3, "1-hop subgraph from root contains root + 2 direct subpages");
  const sub2 = getNHopSubgraph("page-root", 2, allNodes, dedupedEdges);
  assert(sub2.nodes.length === 4, "2-hop subgraph from root contains root, subpages and project (excludes isolated draft)");

  // 8. Test Deterministic Graph Layout
  const layout = computeDeterministicGraphLayout(allNodes, dedupedEdges, 800, 600);
  assert(layout.size === 5, "Layout generates coordinates for all 5 nodes");
  const draftPos = layout.get("page-scratch");
  const rootPos = layout.get("page-root");
  assert(draftPos !== undefined && rootPos !== undefined, "Both connected and isolated nodes have valid positions");
  assert(!isNaN(draftPos!.x) && !isNaN(draftPos!.y), "Isolated node coordinates are finite numbers");

  // 9. Test Hierarchy Tree
  const tree = buildCompanyHierarchyTree(
    [
      { id: "page-root", title: "Company Handbook", parent_page_id: null },
      { id: "page-eng", title: "Engineering Team", parent_page_id: "page-root" },
      { id: "page-design", title: "Design Guidelines", parent_page_id: "page-root" },
    ],
    [{ id: "proj-1", title: "Q4 Redesign", type: "project" }],
    dedupedEdges
  );

  assert(tree.length >= 1, "Hierarchy tree constructs root nodes");
  const rootTree = tree.find((t) => t.id === "page-root");
  assert(rootTree !== undefined && rootTree.children.length === 2, "Root tree node contains both subpages");

  console.log("\n🎉 All 9 deterministic engine tests passed successfully!\n");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
