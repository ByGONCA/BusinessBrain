"use client";

// ==============================================================================
// Company Brain: Company Hierarchy Tree View
// Displays parent/child page structure and entity containment
// ==============================================================================

import * as React from "react";
import {
  HierarchyTreeNode,
  GraphNode,
  EntityType,
} from "@/lib/connections/types";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  FolderGit2,
  CheckSquare,
  Scale,
  Calendar,
  Target,
  FileText,
  User,
  Search,
} from "lucide-react";

interface HierarchyTreeViewProps {
  tree: HierarchyTreeNode[];
  allNodes: GraphNode[];
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNode | null) => void;
  className?: string;
}

const TYPE_ICONS: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  project: FolderGit2,
  task: CheckSquare,
  decision: Scale,
  meeting: Calendar,
  goal: Target,
  document: FileText,
  person: User,
  page: FileText,
};

const TYPE_COLORS: Record<EntityType, string> = {
  project: "text-indigo-500",
  task: "text-blue-500",
  decision: "text-amber-500",
  meeting: "text-purple-500",
  goal: "text-emerald-500",
  document: "text-cyan-500",
  person: "text-orange-500",
  page: "text-zinc-500",
};

export function HierarchyTreeView({
  tree,
  allNodes,
  selectedNodeId,
  onSelectNode,
  className,
}: HierarchyTreeViewProps) {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => {
    // Expand root nodes by default
    return new Set(tree.map((n) => n.id));
  });
  const [searchQuery, setSearchQuery] = React.useState("");

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNodeClick = (node: HierarchyTreeNode) => {
    // If it's a virtual category root, toggle expand
    if (node.id.startsWith("virtual-")) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
      return;
    }

    const matchedGraphNode = allNodes.find((n) => n.id === node.id);
    if (matchedGraphNode) {
      onSelectNode(matchedGraphNode);
    }
  };

  // Filter tree nodes if search query is provided
  function matchesSearch(node: HierarchyTreeNode, query: string): boolean {
    if (node.title.toLowerCase().includes(query)) return true;
    return node.children.some((c) => matchesSearch(c, query));
  }

  const renderNode = (node: HierarchyTreeNode, depth: number = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedNodeId === node.id;
    const Icon = TYPE_ICONS[node.type] || FileText;
    const colorClass = TYPE_COLORS[node.type] || "text-zinc-500";

    if (searchQuery && !matchesSearch(node, searchQuery.toLowerCase())) {
      return null;
    }

    return (
      <div key={node.id} className="space-y-0.5 select-none">
        <div
          onClick={() => handleNodeClick(node)}
          className={cn(
            "group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors",
            isSelected
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
              : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
          )}
          style={{ paddingLeft: `${depth * 16 + 10}px` }}
        >
          {/* Chevron expand button */}
          <button
            type="button"
            onClick={(e) => toggleExpand(node.id, e)}
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-transform",
              !hasChildren && "invisible"
            )}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Type Icon */}
          <Icon className={cn("h-4 w-4 shrink-0", colorClass)} />

          {/* Title */}
          <span className="truncate flex-1">{node.title}</span>

          {/* Connection count badge */}
          {node.connectionCount > 0 && (
            <span className="shrink-0 px-1.5 py-0.2 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 font-mono">
              {node.connectionCount} conn
            </span>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="space-y-0.5">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800", className)}>
      {/* Search within Tree */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter hierarchy..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {tree.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500">
            No hierarchy structures found.
          </div>
        ) : (
          tree.map((root) => renderNode(root, 0))
        )}
      </div>
    </div>
  );
}
