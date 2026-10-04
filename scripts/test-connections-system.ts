/**
 * Company Connections & Graph Traversal Verification Suite
 * Tests deterministic graph algorithms, BFS traversal, shortest path,
 * inverse relationship semantics, and hierarchy tree generation.
 */

import {
  GraphNode,
  GraphEdge,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_LABELS,
} from "../lib/connections/types";
import {
  buildAdjacencyList,
  getDirectNeighbors,
  getNHopSubgraph,
  findShortestPathBFS,
  buildCompanyHierarchyTree,
} from "../lib/connections/graph-algorithms";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("COMPANY BRAIN: CONNECTIONS & GRAPH VERIFICATION SUITE");
  console.log("=======================================================\n");

  // ---------------------------------------------------------------------------
  // 1. CANONICAL RELATIONSHIPS & INVERSE SEMANTICS
  // ---------------------------------------------------------------------------
  console.log("[1] Testing Canonical Relationship Types & Inverse Semantics:");
  assert(RELATIONSHIP_TYPES.length === 13, "Contains exactly 13 canonical relationship types");

  assert(
    RELATIONSHIP_LABELS.part_of.forward === "Part of" &&
      RELATIONSHIP_LABELS.part_of.reverse === "Contains",
    "part_of has reverse 'Contains'"
  );

  assert(
    RELATIONSHIP_LABELS.depends_on.forward === "Depends on" &&
      RELATIONSHIP_LABELS.depends_on.reverse === "Prerequisite for",
    "depends_on has reverse 'Prerequisite for'"
  );

  assert(
    RELATIONSHIP_LABELS.decided_in.forward === "Decided in" &&
      RELATIONSHIP_LABELS.decided_in.reverse === "Decisions made",
    "decided_in has reverse 'Decisions made'"
  );

  assert(
    RELATIONSHIP_LABELS.assigned_to.forward === "Assigned to" &&
      RELATIONSHIP_LABELS.assigned_to.reverse === "Assignee of",
    "assigned_to has reverse 'Assignee of'"
  );

  // ---------------------------------------------------------------------------
  // 2. ADJACENCY & DIRECT NEIGHBORS
  // ---------------------------------------------------------------------------
  console.log("\n[2] Testing Adjacency Map & Direct Neighbor Traversal:");
  const testNodes: GraphNode[] = [
    { id: "page-1", type: "page", title: "Architecture", organization_id: "org-1", degree: 2, inDegree: 0, outDegree: 2 },
    { id: "proj-1", type: "project", title: "Project Alpha", organization_id: "org-1", degree: 3, inDegree: 1, outDegree: 2 },
    { id: "task-1", type: "task", title: "DB Migration", organization_id: "org-1", degree: 2, inDegree: 1, outDegree: 1 },
    { id: "meet-1", type: "meeting", title: "Arch Review", organization_id: "org-1", degree: 2, inDegree: 1, outDegree: 1 },
    { id: "dec-1", type: "decision", title: "Use Postgres", organization_id: "org-1", degree: 1, inDegree: 1, outDegree: 0 },
    { id: "iso-1", type: "goal", title: "Isolated Goal", organization_id: "org-1", degree: 0, inDegree: 0, outDegree: 0 },
  ];

  const testEdges: GraphEdge[] = [
    { id: "e1", source: "page-1", sourceType: "page", target: "proj-1", targetType: "project", relationshipType: "related_to", label: "Related to", reverseLabel: "Related to" },
    { id: "e2", source: "page-1", sourceType: "page", target: "task-1", targetType: "task", relationshipType: "supports", label: "Supports", reverseLabel: "Supported by" },
    { id: "e3", source: "proj-1", sourceType: "project", target: "task-1", targetType: "task", relationshipType: "part_of", label: "Part of", reverseLabel: "Contains" },
    { id: "e4", source: "proj-1", sourceType: "project", target: "meet-1", targetType: "meeting", relationshipType: "discussed_in", label: "Discussed in", reverseLabel: "Topics discussed" },
    { id: "e5", source: "meet-1", sourceType: "meeting", target: "dec-1", targetType: "decision", relationshipType: "decided_in", label: "Decided in", reverseLabel: "Decisions made" },
  ];

  const adjacency = buildAdjacencyList(testNodes, testEdges);
  assert(adjacency.outgoing.get("page-1")?.length === 2, "page-1 has 2 outgoing edges");
  assert(adjacency.incoming.get("task-1")?.length === 2, "task-1 has 2 incoming edges (page-1, proj-1)");
  assert(adjacency.undirected.get("meet-1")?.length === 2, "meet-1 has 2 undirected neighbors (proj-1, dec-1)");

  const neighborsOfProj = getDirectNeighbors("proj-1", testEdges);
  assert(neighborsOfProj.incoming.length === 1 && neighborsOfProj.incoming[0].source === "page-1", "Incoming neighbor of proj-1 is page-1");
  assert(neighborsOfProj.outgoing.length === 2, "Outgoing neighbors count of proj-1 is 2");
  assert(neighborsOfProj.neighborIds.has("page-1") && neighborsOfProj.neighborIds.has("task-1") && neighborsOfProj.neighborIds.has("meet-1"), "Direct neighbor IDs set contains page-1, task-1, meet-1");

  // ---------------------------------------------------------------------------
  // 3. DETERMINISTIC N-HOP TRAVERSAL (BFS)
  // ---------------------------------------------------------------------------
  console.log("\n[3] Testing Deterministic N-Hop Subgraph Traversal:");
  const oneHopFromMeet = getNHopSubgraph("meet-1", 1, testNodes, testEdges);
  const oneHopIds = new Set(oneHopFromMeet.nodes.map((n) => n.id));
  assert(oneHopIds.has("meet-1") && oneHopIds.has("proj-1") && oneHopIds.has("dec-1"), "1-hop from meet-1 includes meet-1, proj-1, dec-1");
  assert(!oneHopIds.has("page-1"), "1-hop from meet-1 excludes 2-hop page-1");

  const twoHopFromMeet = getNHopSubgraph("meet-1", 2, testNodes, testEdges);
  const twoHopIds = new Set(twoHopFromMeet.nodes.map((n) => n.id));
  assert(twoHopIds.has("page-1") && twoHopIds.has("task-1"), "2-hop from meet-1 reaches page-1 and task-1");
  assert(!twoHopIds.has("iso-1"), "2-hop from meet-1 does not reach disconnected iso-1");

  const isolatedSubgraph = getNHopSubgraph("iso-1", 3, testNodes, testEdges);
  assert(isolatedSubgraph.nodes.length === 1 && isolatedSubgraph.edges.length === 0, "Isolated node returns only itself with 0 edges");

  // ---------------------------------------------------------------------------
  // 4. DETERMINISTIC SHORTEST PATH (BFS)
  // ---------------------------------------------------------------------------
  console.log("\n[4] Testing Deterministic BFS Shortest Path Finder:");
  // Path from page-1 to dec-1: page-1 -> proj-1 -> meet-1 -> dec-1 (3 hops)
  const pathResult = findShortestPathBFS("page-1", "dec-1", testNodes, testEdges);
  assert(pathResult.found === true, "Path found between page-1 and dec-1");
  assert(pathResult.totalHops === 3, "Shortest path length is 3 hops");
  assert(pathResult.path[0].node.id === "page-1", "Path starts at page-1");
  assert(pathResult.path[1].node.id === "proj-1" || pathResult.path[1].node.id === "task-1", "Path visits valid intermediate node");
  assert(pathResult.path[pathResult.path.length - 1].node.id === "dec-1", "Path ends at dec-1");

  // Same node path
  const selfPath = findShortestPathBFS("page-1", "page-1", testNodes, testEdges);
  assert(selfPath.found === true && selfPath.totalHops === 0, "Self path is 0 hops");

  // Disconnected path
  const noPath = findShortestPathBFS("page-1", "iso-1", testNodes, testEdges);
  assert(noPath.found === false && noPath.path.length === 0, "Disconnected nodes return found = false");

  // ---------------------------------------------------------------------------
  // 5. HIERARCHY TREE CONSTRUCTION
  // ---------------------------------------------------------------------------
  console.log("\n[5] Testing Hierarchy Tree Construction:");
  const testPages = [
    { id: "root-page", title: "Company", parent_page_id: null },
    { id: "child-page", title: "Engineering", parent_page_id: "root-page" },
  ];
  const testEntities = [
    { id: "task-part", title: "Feature X", type: "task" as const },
    { id: "unparented-doc", title: "Handbook", type: "document" as const },
  ];
  const testTreeEdges: GraphEdge[] = [
    { id: "te1", source: "task-part", sourceType: "task", target: "child-page", targetType: "page", relationshipType: "part_of", label: "Part of", reverseLabel: "Contains" },
  ];

  const tree = buildCompanyHierarchyTree(testPages, testEntities, testTreeEdges);
  assert(tree.length > 0, "Hierarchy tree built successfully");
  const root = tree.find((t) => t.id === "root-page");
  assert(Boolean(root), "Root page exists in tree");
  assert(Boolean(root?.children.some((c) => c.id === "child-page")), "Child page is nested under root page");
  const child = root?.children.find((c) => c.id === "child-page");
  assert(Boolean(child?.children.some((c) => c.id === "task-part")), "task-part is attached as child under child-page via part_of");

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Verification suite failed:", err);
  process.exit(1);
});
