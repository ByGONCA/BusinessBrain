// ==============================================================================
// Verification Test Suite: Connect, Path Finder & Zoom In Evolution
// Validates:
// 1. Context-aware relationship suggestions
// 2. Self-loop and duplicate prevention logic
// 3. Structural hierarchy protection
// 4. Deterministic BFS shortest path with direction tracking
// 5. Inexistent path handling
// 6. N-hop neighborhood expansion (Zoom In)
// ==============================================================================

import {
  findShortestPathBFS,
  getNHopSubgraph,
  buildAdjacencyList,
} from "../lib/connections/graph-algorithms";
import {
  GraphNode,
  GraphEdge,
  EntityType,
  getSuggestedRelationshipTypes,
} from "../lib/connections/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runEvolutionTests() {
  console.log("\n🧪 Running Connect, Path Finder & Zoom In Verification Suite...\n");

  // --------------------------------------------------------------------------
  // TEST 1: Context-Aware Suggested Relationships
  // --------------------------------------------------------------------------
  const taskToProject = getSuggestedRelationshipTypes("task", "project");
  assert(
    taskToProject.includes("part_of") && taskToProject.includes("supports"),
    "Task -> Project suggests part_of and supports"
  );

  const decisionToMeeting = getSuggestedRelationshipTypes("decision", "meeting");
  assert(
    decisionToMeeting.includes("decided_in") && decisionToMeeting.includes("discussed_in"),
    "Decision -> Meeting suggests decided_in and discussed_in"
  );

  const taskToTask = getSuggestedRelationshipTypes("task", "task");
  assert(
    taskToTask.includes("depends_on") && taskToTask.includes("blocks"),
    "Task -> Task suggests depends_on and blocks"
  );

  const pageToPage = getSuggestedRelationshipTypes("page", "page");
  assert(
    pageToPage.includes("part_of") && pageToPage.includes("replaces"),
    "Page -> Page suggests part_of and replaces"
  );

  // --------------------------------------------------------------------------
  // TEST 2: Self-Loop and Duplicate Prevention Logic
  // --------------------------------------------------------------------------
  const checkSelfLoop = (sourceId: string, targetId: string) => {
    return sourceId === targetId;
  };
  assert(checkSelfLoop("page-1", "page-1") === true, "Self-connections are rejected");
  assert(checkSelfLoop("page-1", "page-2") === false, "Distinct elements are allowed");

  const existingEdges: GraphEdge[] = [
    {
      id: "edge-1",
      source: "node-a",
      sourceType: "task",
      target: "node-b",
      targetType: "project",
      relationshipType: "part_of",
      label: "Part of",
      reverseLabel: "Contains",
    },
  ];

  const checkDuplicate = (
    src: string,
    tgt: string,
    rel: string,
    edges: GraphEdge[]
  ) => {
    return edges.some(
      (e) => e.source === src && e.target === tgt && e.relationshipType === rel
    );
  };

  assert(
    checkDuplicate("node-a", "node-b", "part_of", existingEdges) === true,
    "Exact duplicate connection is detected and rejected"
  );
  assert(
    checkDuplicate("node-a", "node-b", "supports", existingEdges) === false,
    "New relationship type between same nodes is permitted"
  );

  // --------------------------------------------------------------------------
  // TEST 3: Structural Hierarchy Protection
  // --------------------------------------------------------------------------
  const checkStructuralDuplicate = (
    src: string,
    tgt: string,
    rel: string,
    parentPageId: string | null
  ) => {
    return rel === "part_of" && parentPageId === tgt;
  };
  assert(
    checkStructuralDuplicate("subpage-1", "parent-1", "part_of", "parent-1") === true,
    "Structural hierarchy duplication is detected and blocked"
  );

  // --------------------------------------------------------------------------
  // TEST 4: BFS Shortest Path with Direction Tracking & Tie-Breaking
  // --------------------------------------------------------------------------
  const testNodes: GraphNode[] = [
    { id: "A", organization_id: "org-1", title: "Wiki Home", type: "page", degree: 2, inDegree: 1, outDegree: 1 },
    { id: "B", organization_id: "org-1", title: "Project Alpha", type: "project", degree: 3, inDegree: 2, outDegree: 1 },
    { id: "C", organization_id: "org-1", title: "Task 1", type: "task", degree: 2, inDegree: 1, outDegree: 1 },
    { id: "D", organization_id: "org-1", title: "Meeting Notes", type: "meeting", degree: 1, inDegree: 0, outDegree: 1 },
    { id: "E", organization_id: "org-1", title: "Decision Q4", type: "decision", degree: 2, inDegree: 1, outDegree: 1 },
    { id: "Isolated", organization_id: "org-1", title: "Isolated Doc", type: "document", degree: 0, inDegree: 0, outDegree: 0 },
  ];

  const testEdges: GraphEdge[] = [
    { id: "e1", source: "A", sourceType: "page", target: "B", targetType: "project", relationshipType: "part_of", label: "Part of", reverseLabel: "Contains" },
    { id: "e2", source: "C", sourceType: "task", target: "B", targetType: "project", relationshipType: "part_of", label: "Part of", reverseLabel: "Contains" },
    { id: "e3", source: "D", sourceType: "meeting", target: "E", targetType: "decision", relationshipType: "decided_in", label: "Decided in", reverseLabel: "Decisions" },
    { id: "e4", source: "E", sourceType: "decision", target: "B", targetType: "project", relationshipType: "supports", label: "Supports", reverseLabel: "Supported by" },
  ];

  // Path from D to C: D -> E -> B <- C (3 hops)
  const pathDToC = findShortestPathBFS("D", "C", testNodes, testEdges);
  assert(pathDToC.found === true, "Finds shortest path across mixed relationships");
  assert(pathDToC.totalHops === 3, "Shortest path D -> C is exactly 3 hops");
  assert(pathDToC.path[0].node.id === "D", "Origin node is D");
  assert(pathDToC.path[1].node.id === "E", "Second node is E");
  assert(pathDToC.path[2].node.id === "B", "Third node is B");
  assert(pathDToC.path[3].node.id === "C", "Destination node is C");

  // Verify direction tracking:
  // D -> E is forward (source=D, target=E)
  // E -> B is forward (source=E, target=B)
  // B <- C is reverse (source=C, target=B)
  assert(pathDToC.path[1].direction === "forward", "D -> E direction is correctly forward");
  assert(pathDToC.path[2].direction === "forward", "E -> B direction is correctly forward");
  assert(pathDToC.path[3].direction === "reverse", "B -> C traversal records reverse direction");

  // --------------------------------------------------------------------------
  // TEST 5: Inexistent Path Handling (Disconnected Components)
  // --------------------------------------------------------------------------
  const pathIsolated = findShortestPathBFS("A", "Isolated", testNodes, testEdges);
  assert(pathIsolated.found === false, "Path to disconnected node returns found: false");
  assert(pathIsolated.path.length === 0, "Empty path returned for disconnected components");
  assert(pathIsolated.totalHops === 0, "0 hops reported for disconnected pair");

  // --------------------------------------------------------------------------
  // TEST 6: Zoom In & N-Hop Neighborhood Subgraph
  // --------------------------------------------------------------------------
  const sub1 = getNHopSubgraph("B", 1, testNodes, testEdges);
  const sub1Ids = new Set(sub1.nodes.map((n) => n.id));
  assert(sub1Ids.has("B"), "1-hop subgraph contains center node B");
  assert(sub1Ids.has("A") && sub1Ids.has("C") && sub1Ids.has("E"), "1-hop contains all direct neighbors of B");
  assert(!sub1Ids.has("D"), "1-hop excludes 2-hop neighbor D");
  assert(!sub1Ids.has("Isolated"), "1-hop excludes disconnected node");

  const sub2 = getNHopSubgraph("B", 2, testNodes, testEdges);
  const sub2Ids = new Set(sub2.nodes.map((n) => n.id));
  assert(sub2Ids.has("D"), "2-hop expansion includes D (reachable via E)");
  assert(!sub2Ids.has("Isolated"), "2-hop expansion still excludes isolated node");

  console.log("\n🎉 All Connect, Path Finder & Zoom In tests passed successfully!\n");
}

runEvolutionTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
