"use client";

// ==============================================================================
// Company Brain: Deterministic Shortest Path Modal
// Computes and visualizes connection trails between two objects
// ==============================================================================

import * as React from "react";
import {
  GraphNode,
  GraphEdge,
  ShortestPathResult,
  RELATIONSHIP_LABELS,
} from "@/lib/connections/types";
import { findShortestPathBFS } from "@/lib/connections/graph-algorithms";
import { cn } from "@/lib/utils";
import {
  X,
  Route,
  ArrowDown,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
} from "lucide-react";

interface ShortestPathModalProps {
  isOpen: boolean;
  onClose: () => void;
  allNodes: GraphNode[];
  allEdges: GraphEdge[];
  initialStartNodeId?: string;
  onApplyPathHighlight: (nodeIds: string[], edgeIds: string[]) => void;
}

export function ShortestPathModal({
  isOpen,
  onClose,
  allNodes,
  allEdges,
  initialStartNodeId,
  onApplyPathHighlight,
}: ShortestPathModalProps) {
  const [startId, setStartId] = React.useState<string>(initialStartNodeId || "");
  const [targetId, setTargetId] = React.useState<string>("");
  const [result, setResult] = React.useState<ShortestPathResult | null>(null);
  const [hasCalculated, setHasCalculated] = React.useState(false);

  React.useEffect(() => {
    if (initialStartNodeId) {
      setStartId(initialStartNodeId);
    }
  }, [initialStartNodeId]);

  if (!isOpen) return null;

  const handleCalculate = () => {
    if (!startId || !targetId) return;
    const res = findShortestPathBFS(startId, targetId, allNodes, allEdges);
    setResult(res);
    setHasCalculated(true);
  };

  const handleHighlight = () => {
    if (!result || !result.found) return;
    const nodeIds = result.path.map((p) => p.node.id);
    const edgeIds = result.path.map((p) => p.edge?.id).filter(Boolean) as string[];
    onApplyPathHighlight(nodeIds, edgeIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
              <Route className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Find Shortest Connection Path
              </h3>
              <p className="text-xs text-zinc-400">
                Deterministic BFS relationship traversal (Zero AI)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Selection */}
        <div className="p-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Origin Object
            </label>
            <select
              value={startId}
              onChange={(e) => {
                setStartId(e.target.value);
                setHasCalculated(false);
              }}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select Origin...</option>
              {allNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  [{n.type.toUpperCase()}] {n.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Destination Object
            </label>
            <select
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value);
                setHasCalculated(false);
              }}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select Destination...</option>
              {allNodes
                .filter((n) => n.id !== startId)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    [{n.type.toUpperCase()}] {n.title}
                  </option>
                ))}
            </select>
          </div>

          <button
            type="button"
            disabled={!startId || !targetId}
            onClick={handleCalculate}
            className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            Compute Shortest Path
          </button>
        </div>

        {/* Path Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {!hasCalculated ? (
            <div className="text-center py-8 text-xs text-zinc-400">
              Select origin and destination to compute how they are connected.
            </div>
          ) : !result?.found ? (
            <div className="text-center py-8 space-y-2">
              <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                No connection path found
              </p>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                These two objects belong to disconnected components in your Company Map.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Path Discovered ({result.totalHops} hop{result.totalHops !== 1 ? "s" : ""})
                </span>
                <button
                  type="button"
                  onClick={handleHighlight}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Highlight on Graph</span>
                </button>
              </div>

              {/* Step-by-step breadcrumb trail */}
              <div className="space-y-2 relative pl-4 border-l-2 border-emerald-500/30">
                {result.path.map((step, idx) => {
                  return (
                    <div key={step.node.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                          {step.node.type}
                        </span>
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {step.node.title}
                        </span>
                      </div>

                      {step.edge && idx < result.path.length - 1 && (
                        <div className="flex items-center gap-2 py-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <ArrowDown className="h-3.5 w-3.5" />
                          <span>
                            {step.edge.label || step.edge.relationshipType}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
