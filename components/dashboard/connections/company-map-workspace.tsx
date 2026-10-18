"use client";

// ==============================================================================
// Company Brain: Company Map Workspace
// Master workspace integrating Graph View, Tree View, Traversal & Details
// ==============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CompanyGraphData,
  GraphNode,
  GraphEdge,
  EntityType,
  HierarchyTreeNode,
} from "@/lib/connections/types";
import { buildCompanyHierarchyTree } from "@/lib/connections/graph-algorithms";
import { InteractiveGraphCanvas } from "./interactive-graph-canvas";
import { HierarchyTreeView } from "./hierarchy-tree-view";
import { NodeDetailsDrawer } from "./node-details-drawer";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const ShortestPathModal = dynamic(
  () => import("./shortest-path-modal").then((m) => m.ShortestPathModal),
  { ssr: false }
);

const CreateConnectionModal = dynamic(
  () => import("./create-connection-modal").then((m) => m.CreateConnectionModal),
  { ssr: false }
);
import {
  Search,
  Plus,
  Route,
  Sparkles,
  Layers,
  Eye,
  Filter,
} from "lucide-react";
import { PhosphorNetwork, PhosphorGitFork } from "@/components/icons";

interface CompanyMapWorkspaceProps {
  initialGraph: CompanyGraphData;
  pages: Array<{ id: string; title: string; icon?: string | null; parent_page_id?: string | null }>;
  entities: Array<{ id: string; title: string; type: EntityType }>;
  initialSelectedNodeId?: string;
  initialFocusDepth?: number;
}

export function CompanyMapWorkspace({
  initialGraph,
  pages,
  entities,
  initialSelectedNodeId,
  initialFocusDepth,
}: CompanyMapWorkspaceProps) {
  const router = useRouter();

  // Graph state
  const [nodes, setNodes] = React.useState<GraphNode[]>(initialGraph.nodes);
  const [edges, setEdges] = React.useState<GraphEdge[]>(initialGraph.edges);

  // Draft filter state (hides isolated untitled scratchpads by default)
  const [showDrafts, setShowDrafts] = React.useState(false);

  // View state
  const [activeView, setActiveView] = React.useState<"graph" | "tree">("graph");
  const [selectedNode, setSelectedNode] = React.useState<GraphNode | null>(() => {
    if (initialSelectedNodeId) {
      return initialGraph.nodes.find((n) => n.id === initialSelectedNodeId) || null;
    }
    return null;
  });
  const [focusDepth, setFocusDepth] = React.useState<number | null>(
    initialFocusDepth ?? null
  );
  const [filterType, setFilterType] = React.useState<EntityType | "all">("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Hidden empty drafts count
  const hiddenDraftsCount = React.useMemo(() => {
    return nodes.filter((n) => n.isDraft && n.degree === 0).length;
  }, [nodes]);

  // Nodes and edges filtered according to draft toggle
  const visibleNodes = React.useMemo(() => {
    if (showDrafts) return nodes;
    return nodes.filter((n) => !(n.isDraft && n.degree === 0) || n.id === selectedNode?.id);
  }, [nodes, showDrafts, selectedNode?.id]);

  const visibleNodeIds = React.useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = React.useMemo(() => {
    return edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [edges, visibleNodeIds]);

  // Path highlight state
  const [highlightedPathNodeIds, setHighlightedPathNodeIds] = React.useState<string[]>([]);
  const [highlightedPathEdgeIds, setHighlightedPathEdgeIds] = React.useState<string[]>([]);

  // Modals
  const [isConnectModalOpen, setIsConnectModalOpen] = React.useState(false);
  const [connectSourceNode, setConnectSourceNode] = React.useState<GraphNode | null>(null);

  const [isPathModalOpen, setIsPathModalOpen] = React.useState(false);
  const [pathStartNode, setPathStartNode] = React.useState<GraphNode | null>(null);

  // Pre-calculate Hierarchy Tree
  const hierarchyTree = React.useMemo<HierarchyTreeNode[]>(() => {
    return buildCompanyHierarchyTree(pages, entities, edges);
  }, [pages, entities, edges]);

  // Synchronize when initialGraph updates
  React.useEffect(() => {
    setNodes(initialGraph.nodes);
    setEdges(initialGraph.edges);
  }, [initialGraph]);

  // Deep linking initial selection
  React.useEffect(() => {
    if (initialSelectedNodeId) {
      const match = nodes.find((n) => n.id === initialSelectedNodeId);
      if (match) setSelectedNode(match);
    }
  }, [initialSelectedNodeId, nodes]);

  // Handle edge removal
  const handleConnectionRemoved = (edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    // Also clear path highlight if edge was part of it
    setHighlightedPathEdgeIds((prev) => prev.filter((id) => id !== edgeId));
  };

  // Handle connection created
  const handleConnectionCreated = (newEdge: GraphEdge) => {
    setEdges((prev) => [...prev, newEdge]);
    // Update degree count in nodes
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === newEdge.source) {
          return { ...n, degree: n.degree + 1, outDegree: n.outDegree + 1 };
        }
        if (n.id === newEdge.target) {
          return { ...n, degree: n.degree + 1, inDegree: n.inDegree + 1 };
        }
        return n;
      })
    );
  };

  // Open entity corresponding to node type
  const handleOpenNode = React.useCallback(
    (node: GraphNode) => {
      if (node.type === "page") {
        router.push(`/dashboard/pages/${node.id}`);
      } else if (node.type === "task") {
        router.push("/dashboard/tasks");
      } else if (node.type === "project") {
        router.push("/dashboard/projects");
      } else if (node.type === "meeting") {
        router.push("/dashboard/meetings");
      } else if (node.type === "decision") {
        router.push("/dashboard/decisions");
      } else {
        router.push("/dashboard");
      }
    },
    [router]
  );

  // Search filter options
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return nodes.filter((n) => n.title.toLowerCase().includes(q)).slice(0, 8);
  }, [nodes, searchQuery]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full overflow-hidden bg-background">
      {/* Top Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-card/60 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-3">
          {/* View Switcher */}
          <div className="flex items-center p-0.5 rounded-xl bg-muted border border-border">
            <button
              type="button"
              onClick={() => setActiveView("graph")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeView === "graph"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <PhosphorNetwork className="h-3.5 w-3.5" />
              <span>Company Graph</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView("tree")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeView === "tree"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <PhosphorGitFork className="h-3.5 w-3.5" />
              <span>Hierarchy Tree</span>
            </button>
          </div>

          {/* Quick Search with Autocomplete */}
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search graph..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            {searchResults.length > 0 && (
              <div className="absolute left-0 top-9 w-full rounded-xl border border-border bg-popover p-1 shadow-xl z-50">
                {searchResults.map((res) => (
                  <div
                    key={res.id}
                    onClick={() => {
                      setSelectedNode(res);
                      setSearchQuery("");
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted cursor-pointer text-xs"
                  >
                    <span className="truncate font-medium">{res.title}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      {res.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Entity Type Filter */}
          <div className="hidden md:flex items-center gap-1">
            {(
              [
                "all",
                "page",
                "project",
                "task",
                "decision",
                "meeting",
                "goal",
              ] as const
            ).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                className={cn(
                  "px-2 py-1 rounded-md text-[11px] font-medium capitalize transition-colors",
                  filterType === t
                    ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          {hiddenDraftsCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDrafts((prev) => !prev)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                showDrafts
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={showDrafts ? "Ocultar rascunhos vazios" : "Mostrar rascunhos vazios isolados"}
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {showDrafts ? "Rascunhos visíveis" : `Rascunhos (${hiddenDraftsCount})`}
              </span>
            </button>
          )}

          {/* Focus Mode active pill */}
          {focusDepth !== null && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
              <span>Vizinhança: {focusDepth} {focusDepth > 1 ? "hops" : "hop"}</span>
              <button
                type="button"
                onClick={() => setFocusDepth(null)}
                className="hover:text-foreground ml-1"
                title="Limpar modo foco"
              >
                ×
              </button>
            </div>
          )}

          {highlightedPathNodeIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setHighlightedPathNodeIds([]);
                setHighlightedPathEdgeIds([]);
              }}
              className="px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
            >
              Limpar Caminho
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setPathStartNode(selectedNode || null);
              setIsPathModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors"
          >
            <Route className="h-3.5 w-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Path Finder</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setConnectSourceNode(selectedNode || null);
              setIsConnectModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Connect</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {nodes.length === 0 ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-500 mb-4 border border-blue-500/20">
              <PhosphorNetwork className="h-10 w-10" />
            </div>
            <h3 className="text-xl font-bold text-foreground">
              Your Company Map is empty
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
              Connect pages, projects, tasks, meetings, and decisions to build your living company knowledge graph.
            </p>
            <button
              type="button"
              onClick={() => setIsConnectModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Connection</span>
            </button>
          </div>
        ) : (
          <>
            {/* View 1: Interactive Graph Canvas */}
            {activeView === "graph" && (
              <InteractiveGraphCanvas
                nodes={visibleNodes}
                edges={visibleEdges}
                selectedNodeId={selectedNode?.id || null}
                onSelectNode={(node) => setSelectedNode(node)}
                onOpenNode={handleOpenNode}
                focusDepth={focusDepth}
                onSetFocusDepth={(d) => setFocusDepth(d)}
                highlightedPathNodeIds={highlightedPathNodeIds}
                highlightedPathEdgeIds={highlightedPathEdgeIds}
                filterType={filterType}
                className="flex-1"
              />
            )}

            {/* View 2: Hierarchy Tree View */}
            {activeView === "tree" && (
              <div className="flex-1 flex">
                <HierarchyTreeView
                  tree={hierarchyTree}
                  allNodes={nodes}
                  selectedNodeId={selectedNode?.id || null}
                  onSelectNode={(node) => setSelectedNode(node)}
                  className="w-full sm:w-96"
                />
                {/* Secondary side-by-side graph on larger screens */}
                <div className="hidden lg:block flex-1 border-l border-border">
                  <InteractiveGraphCanvas
                    nodes={visibleNodes}
                    edges={visibleEdges}
                    selectedNodeId={selectedNode?.id || null}
                    onSelectNode={(node) => setSelectedNode(node)}
                    onOpenNode={handleOpenNode}
                    focusDepth={focusDepth}
                    onSetFocusDepth={(d) => setFocusDepth(d)}
                    highlightedPathNodeIds={highlightedPathNodeIds}
                    highlightedPathEdgeIds={highlightedPathEdgeIds}
                    filterType={filterType}
                  />
                </div>
              </div>
            )}

            {/* Slide-over Node Details Drawer */}
            {selectedNode && (
              <NodeDetailsDrawer
                node={selectedNode}
                edges={edges}
                allNodes={nodes}
                onClose={() => setSelectedNode(null)}
                onSelectNode={(n) => setSelectedNode(n)}
                onOpenConnectModal={(src) => {
                  setConnectSourceNode(src);
                  setIsConnectModalOpen(true);
                }}
                onOpenPathModal={(src) => {
                  setPathStartNode(src);
                  setIsPathModalOpen(true);
                }}
                focusDepth={focusDepth}
                onSetFocusDepth={(d) => setFocusDepth(d)}
                onConnectionRemoved={handleConnectionRemoved}
              />
            )}
          </>
        )}
      </div>

      {/* Shortest Path Finder Modal (Loaded on-demand) */}
      {isPathModalOpen && (
        <ShortestPathModal
          isOpen={isPathModalOpen}
          onClose={() => setIsPathModalOpen(false)}
          allNodes={nodes}
          allEdges={edges}
          initialStartNodeId={pathStartNode?.id}
          onApplyPathHighlight={(nodeIds, edgeIds) => {
            setHighlightedPathNodeIds(nodeIds);
            setHighlightedPathEdgeIds(edgeIds);
            setActiveView("graph");
          }}
          onSelectNode={(node) => setSelectedNode(node)}
          onOpenConnectModal={(src) => {
            setConnectSourceNode(src);
            setIsConnectModalOpen(true);
          }}
        />
      )}

      {/* Manual Connection Creation Modal (Loaded on-demand) */}
      {isConnectModalOpen && (
        <CreateConnectionModal
          isOpen={isConnectModalOpen}
          onClose={() => setIsConnectModalOpen(false)}
          allNodes={nodes}
          initialSourceNodeId={connectSourceNode?.id}
          onConnectionCreated={handleConnectionCreated}
        />
      )}
    </div>
  );
}
