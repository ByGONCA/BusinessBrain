"use client";

// ==============================================================================
// Company Brain: Deterministic Shortest Path Modal (Path Finder)
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
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  Search,
  Plus,
} from "lucide-react";

interface ShortestPathModalProps {
  isOpen: boolean;
  onClose: () => void;
  allNodes: GraphNode[];
  allEdges: GraphEdge[];
  initialStartNodeId?: string;
  onApplyPathHighlight: (nodeIds: string[], edgeIds: string[]) => void;
  onSelectNode?: (node: GraphNode) => void;
  onOpenConnectModal?: (source: GraphNode) => void;
}

export function ShortestPathModal({
  isOpen,
  onClose,
  allNodes,
  allEdges,
  initialStartNodeId,
  onApplyPathHighlight,
  onSelectNode,
  onOpenConnectModal,
}: ShortestPathModalProps) {
  const [startId, setStartId] = React.useState<string>(initialStartNodeId || "");
  const [targetId, setTargetId] = React.useState<string>("");
  const [result, setResult] = React.useState<ShortestPathResult | null>(null);
  const [hasCalculated, setHasCalculated] = React.useState(false);

  // Search states for comboboxes
  const [startSearch, setStartSearch] = React.useState("");
  const [targetSearch, setTargetSearch] = React.useState("");
  const [isStartOpen, setIsStartOpen] = React.useState(false);
  const [isTargetOpen, setIsTargetOpen] = React.useState(false);

  React.useEffect(() => {
    if (initialStartNodeId) {
      setStartId(initialStartNodeId);
    }
  }, [initialStartNodeId]);

  const startNode = React.useMemo(
    () => allNodes.find((n) => n.id === startId) || null,
    [allNodes, startId]
  );
  const targetNode = React.useMemo(
    () => allNodes.find((n) => n.id === targetId) || null,
    [allNodes, targetId]
  );

  // Filter lists
  const filteredStartNodes = React.useMemo(() => {
    if (!startSearch.trim()) return allNodes.slice(0, 30);
    const q = startSearch.toLowerCase();
    return allNodes
      .filter((n) => n.title.toLowerCase().includes(q) || n.type.toLowerCase().includes(q))
      .slice(0, 30);
  }, [allNodes, startSearch]);

  const filteredTargetNodes = React.useMemo(() => {
    const candidates = allNodes.filter((n) => n.id !== startId);
    if (!targetSearch.trim()) return candidates.slice(0, 30);
    const q = targetSearch.toLowerCase();
    return candidates
      .filter((n) => n.title.toLowerCase().includes(q) || n.type.toLowerCase().includes(q))
      .slice(0, 30);
  }, [allNodes, startId, targetSearch]);

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

  const handleStepNodeClick = (node: GraphNode) => {
    if (onSelectNode) {
      onSelectNode(node);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
              <Route className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Path Finder — Caminho Mais Curto
              </h3>
              <p className="text-xs text-zinc-400">
                Travessia determinística (BFS) em relações ativas do grafo
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

        {/* Selection Area */}
        <div className="p-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          {/* Start Node */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Ponto de Partida (Origem)
            </label>
            {startNode && !isStartOpen ? (
              <div className="flex items-center justify-between p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    {startNode.type}
                  </span>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {startNode.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsStartOpen(true);
                    setStartSearch("");
                  }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline shrink-0 ml-2"
                >
                  Alterar
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={startSearch}
                    onChange={(e) => setStartSearch(e.target.value)}
                    placeholder="Pesquisar ponto de partida..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus={isStartOpen}
                  />
                </div>
                <div className="max-h-32 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-700/50">
                  {filteredStartNodes.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setStartId(n.id);
                        setIsStartOpen(false);
                        setHasCalculated(false);
                      }}
                      className="flex items-center justify-between p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer text-xs"
                    >
                      <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                        {n.title}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 ml-2 shrink-0">
                        {n.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Target Node */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Ponto de Destino
            </label>
            {targetNode && !isTargetOpen ? (
              <div className="flex items-center justify-between p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                    {targetNode.type}
                  </span>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {targetNode.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsTargetOpen(true);
                    setTargetSearch("");
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline shrink-0 ml-2"
                >
                  Alterar
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={targetSearch}
                    onChange={(e) => setTargetSearch(e.target.value)}
                    placeholder="Pesquisar ponto de destino..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="max-h-32 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-700/50">
                  {filteredTargetNodes.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setTargetId(n.id);
                        setIsTargetOpen(false);
                        setHasCalculated(false);
                      }}
                      className="flex items-center justify-between p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer text-xs"
                    >
                      <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                        {n.title}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 ml-2 shrink-0">
                        {n.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!startId || !targetId || startId === targetId}
            onClick={handleCalculate}
            className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            Calcular Caminho Mínimo
          </button>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {!hasCalculated ? (
            <div className="text-center py-10 text-xs text-zinc-400">
              Seleciona o ponto de partida e o destino para descobrir como estão conectados.
            </div>
          ) : !result?.found ? (
            <div className="text-center py-8 space-y-3">
              <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Nenhum caminho encontrado
              </p>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                Estes dois elementos pertencem a componentes desconexos no grafo da empresa. Não existem relações diretas ou intermediárias entre eles.
              </p>
              {startNode && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenConnectModal) onOpenConnectModal(startNode);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Criar Conexão entre eles</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Caminho Descoberto ({result.totalHops} {result.totalHops === 1 ? "salto" : "saltos"})
                </span>
                <button
                  type="button"
                  onClick={handleHighlight}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Destacar no Grafo</span>
                </button>
              </div>

              {/* Step-by-step breadcrumb trail */}
              <div className="space-y-2 relative pl-4 border-l-2 border-emerald-500/40">
                {result.path.map((step, idx) => {
                  const edge = step.edge;
                  const isLast = idx === result.path.length - 1;
                  const label =
                    step.direction === "reverse"
                      ? edge?.reverseLabel || (edge ? RELATIONSHIP_LABELS[edge.relationshipType]?.reverse : "") || edge?.relationshipType
                      : edge?.label || (edge ? RELATIONSHIP_LABELS[edge.relationshipType]?.forward : "") || edge?.relationshipType;

                  return (
                    <div key={`${step.node.id}-${idx}`} className="space-y-2">
                      <div
                        onClick={() => handleStepNodeClick(step.node)}
                        className="group flex items-center justify-between p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700 hover:border-emerald-500 cursor-pointer transition-colors"
                        title="Clica para inspecionar os detalhes deste nó"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 shrink-0">
                            {step.node.type}
                          </span>
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                            {step.node.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          Inspecionar →
                        </span>
                      </div>

                      {edge && !isLast && (
                        <div className="flex items-center gap-2 py-1 pl-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <span className="font-mono text-[11px]">
                            {step.direction === "reverse" ? "←" : "→"}
                          </span>
                          <span>{label}</span>
                          {edge.isStructural && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-mono">
                              Hierarquia
                            </span>
                          )}
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
