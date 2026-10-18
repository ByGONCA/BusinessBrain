"use client";

// ==============================================================================
// Company Brain: Node Details Drawer
// Displays connections, backlinks, statistics, and node actions
// ==============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  GraphNode,
  GraphEdge,
  EntityType,
  RELATIONSHIP_LABELS,
} from "@/lib/connections/types";
import { removeConnectionAction } from "@/lib/connections/actions";
import { PageIcon } from "@/components/dashboard/pages/page-icon";
import { cn } from "@/lib/utils";
import {
  X,
  ExternalLink,
  Target,
  Plus,
  Route,
  Trash2,
  FolderGit2,
  CheckSquare,
  Scale,
  Calendar,
  FileText,
  User,
  ArrowRight,
  ArrowLeft,
  Eye,
} from "lucide-react";

interface NodeDetailsDrawerProps {
  node: GraphNode | null;
  edges: GraphEdge[];
  allNodes: GraphNode[];
  onClose: () => void;
  onSelectNode: (node: GraphNode) => void;
  onOpenConnectModal: (sourceNode: GraphNode) => void;
  onOpenPathModal: (startNode: GraphNode) => void;
  focusDepth: number | null;
  onSetFocusDepth: (depth: number | null) => void;
  onConnectionRemoved?: (connectionId: string) => void;
  className?: string;
}

const TYPE_CONFIG: Record<
  EntityType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  project: { label: "Project", icon: FolderGit2, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800" },
  task: { label: "Task", icon: CheckSquare, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" },
  decision: { label: "Decision", icon: Scale, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" },
  meeting: { label: "Meeting", icon: Calendar, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800" },
  goal: { label: "Goal", icon: Target, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" },
  document: { label: "Document", icon: FileText, color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800" },
  person: { label: "Person", icon: User, color: "text-orange-600 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800" },
  page: { label: "Page", icon: FileText, color: "text-zinc-600 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700" },
};

export function NodeDetailsDrawer({
  node,
  edges,
  allNodes,
  onClose,
  onSelectNode,
  onOpenConnectModal,
  onOpenPathModal,
  focusDepth,
  onSetFocusDepth,
  onConnectionRemoved,
  className,
}: NodeDetailsDrawerProps) {
  const router = useRouter();
  const [isDeletingId, setIsDeletingId] = React.useState<string | null>(null);

  if (!node) return null;

  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  const cfg = TYPE_CONFIG[node.type] || TYPE_CONFIG.document;
  const Icon = cfg.icon;

  // Separate Outgoing and Incoming Backlinks
  const outgoingEdges = edges.filter((e) => e.source === node.id);
  const incomingEdges = edges.filter((e) => e.target === node.id);

  const handleOpenObject = () => {
    if (node.type === "page") {
      router.push(`/dashboard/pages/${node.id}`);
    } else {
      // For entities, navigate to their respective sections
      if (node.type === "task") router.push("/dashboard/tasks");
      else if (node.type === "project") router.push("/dashboard/projects");
      else if (node.type === "meeting") router.push("/dashboard/meetings");
      else if (node.type === "decision") router.push("/dashboard/decisions");
      else router.push("/dashboard");
    }
  };

  const handleRemoveEdge = async (edge: GraphEdge, label: string) => {
    if (edge.isStructural) {
      alert("Esta é uma relação estrutural de subpágina. Para alterá-la, reorganiza a página no menu lateral.");
      return;
    }
    if (!window.confirm(`Remove connection "${label}"? (The connected objects will NOT be deleted).`)) {
      return;
    }
    setIsDeletingId(edge.id);
    const res = await removeConnectionAction(edge.id);
    setIsDeletingId(null);
    if (res.success && onConnectionRemoved) {
      onConnectionRemoved(edge.id);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col w-80 sm:w-96 h-full bg-[#141415] border-l border-[#242427] shadow-xl z-20 animate-in slide-in-from-right duration-200",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-[#242427]">
        <div className="flex items-start gap-3 min-w-0 pr-2">
          <div className={cn("p-2 rounded-xl border shrink-0 flex items-center justify-center", cfg.color)}>
            {node.type === "page" ? (
              <PageIcon icon={node.icon} pageId={node.id} className="text-xl" imgClassName="h-5 w-5 rounded object-cover" />
            ) : (
              <Icon className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#71717A]">
              {cfg.label}
            </span>
            <h3 className="text-base font-bold text-foreground truncate">
              {node.title}
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#71717A] hover:text-foreground hover:bg-[#1C1C1F] transition-colors"
          title="Close details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Isolated Node Advice */}
        {node.isIsolated && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 space-y-1">
            <p className="font-semibold">Nó isolado sem conexões</p>
            <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
              Este elemento ainda não tem relações registadas com outras páginas ou entidades. Podes usar o botão &ldquo;Connect&rdquo; para criar uma ligação explícita.
            </p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleOpenObject}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open Object</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenConnectModal(node)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#242427] hover:bg-[#1C1C1F] text-xs font-medium text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Connect</span>
          </button>
        </div>

        {/* Focus Mode & Path Finder Row */}
        <div className="p-3 rounded-xl bg-[#19191B] border border-[#242427] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-blue-500" /> Foco / Vizinhança
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onSetFocusDepth(focusDepth === d ? null : d)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-semibold transition-colors",
                    focusDepth === d
                      ? "bg-blue-600 text-white"
                      : "bg-[#202023] text-[#A1A1AA] hover:bg-[#242427] hover:text-foreground"
                  )}
                  title={`Ver vizinhança a até ${d} salto${d > 1 ? "s" : ""}`}
                >
                  {d} {d > 1 ? "hops" : "hop"}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onSetFocusDepth(null)}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-semibold transition-colors",
                  focusDepth === null
                    ? "bg-[#242427] text-foreground border border-[#29292D]"
                    : "bg-[#202023] text-[#A1A1AA] hover:bg-[#242427] hover:text-foreground"
                )}
                title="Mostrar todo o grafo sem esmaecer nós distantes"
              >
                Todos
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const nextDepth = focusDepth === null ? 1 : Math.min(3, focusDepth + 1);
                onSetFocusDepth(nextDepth);
              }}
              className="flex-1 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors text-center"
            >
              Expandir Vizinhança (+1 hop)
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSetFocusDepth(null);
              }}
              className="py-1.5 px-2.5 rounded-lg border border-[#242427] text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-foreground text-xs transition-colors"
              title="Regressar à visão geral completa"
            >
              Visão Geral
            </button>
          </div>

          <button
            type="button"
            onClick={() => onOpenPathModal(node)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-[#242427] hover:bg-[#1C1C1F] text-xs text-[#A1A1AA] hover:text-foreground font-medium transition-colors"
          >
            <Route className="h-3.5 w-3.5 text-emerald-500" />
            <span>Encontrar Caminho para Outro Nó...</span>
          </button>
        </div>

        {/* Statistics Pill */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-xl bg-[#19191B] border border-[#242427]">
            <span className="block text-lg font-bold text-foreground">
              {node.degree}
            </span>
            <span className="text-[10px] text-[#71717A]">Total Conn</span>
          </div>
          <div className="p-2 rounded-xl bg-[#19191B] border border-[#242427]">
            <span className="block text-lg font-bold text-blue-400">
              {node.outDegree}
            </span>
            <span className="text-[10px] text-[#71717A]">Outgoing</span>
          </div>
          <div className="p-2 rounded-xl bg-[#19191B] border border-[#242427]">
            <span className="block text-lg font-bold text-indigo-400">
              {node.inDegree}
            </span>
            <span className="text-[10px] text-[#71717A]">Backlinks</span>
          </div>
        </div>

        {/* Outgoing Connections */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#71717A] flex items-center gap-1.5">
            <ArrowRight className="h-3.5 w-3.5 text-blue-500" />
            Outgoing Connections ({outgoingEdges.length})
          </h4>

          {outgoingEdges.length === 0 ? (
            <p className="text-xs text-[#71717A] italic">No outgoing connections.</p>
          ) : (
            <div className="space-y-1.5">
              {outgoingEdges.map((e) => {
                const targetNode = nodeMap.get(e.target);
                const targetTitle = targetNode?.title || "Unknown target";
                const relLabel = e.label || RELATIONSHIP_LABELS[e.relationshipType]?.forward || e.relationshipType;

                return (
                  <div
                    key={e.id}
                    className="group flex items-center justify-between p-2 rounded-lg border border-[#242427] bg-[#19191B] hover:border-[#29292D] transition-colors"
                  >
                    <div
                      onClick={() => targetNode && onSelectNode(targetNode)}
                      className="min-w-0 flex-1 cursor-pointer pr-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-blue-400">
                          → {relLabel}
                        </span>
                        {e.isStructural && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-[#242427] text-[#A1A1AA] font-mono">
                            Hierarchy
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        {targetNode?.type === "page" && (
                          <PageIcon icon={targetNode.icon} pageId={targetNode.id} className="text-xs shrink-0" imgClassName="h-3.5 w-3.5 rounded object-cover" />
                        )}
                        <p className="text-xs font-medium text-foreground truncate">
                          {targetTitle}
                        </p>
                      </div>
                    </div>

                    {!e.isStructural && (
                      <button
                        type="button"
                        disabled={isDeletingId === e.id}
                        onClick={() => handleRemoveEdge(e, relLabel)}
                        className="p-1 rounded text-[#71717A] hover:text-red-400 hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove connection"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Incoming Backlinks */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#71717A] flex items-center gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5 text-indigo-400" />
            Incoming Backlinks ({incomingEdges.length})
          </h4>

          {incomingEdges.length === 0 ? (
            <p className="text-xs text-[#71717A] italic">No incoming backlinks.</p>
          ) : (
            <div className="space-y-1.5">
              {incomingEdges.map((e) => {
                const sourceNode = nodeMap.get(e.source);
                const sourceTitle = sourceNode?.title || "Unknown source";
                const reverseLabel = e.reverseLabel || RELATIONSHIP_LABELS[e.relationshipType]?.reverse || e.relationshipType;

                return (
                  <div
                    key={e.id}
                    className="group flex items-center justify-between p-2 rounded-lg border border-[#242427] bg-[#19191B] hover:border-[#29292D] transition-colors"
                  >
                    <div
                      onClick={() => sourceNode && onSelectNode(sourceNode)}
                      className="min-w-0 flex-1 cursor-pointer pr-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-indigo-400">
                          ← {reverseLabel}
                        </span>
                        {e.isStructural && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-[#242427] text-[#A1A1AA] font-mono">
                            Hierarchy
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        {sourceNode?.type === "page" && (
                          <PageIcon icon={sourceNode.icon} pageId={sourceNode.id} className="text-xs shrink-0" imgClassName="h-3.5 w-3.5 rounded object-cover" />
                        )}
                        <p className="text-xs font-medium text-foreground truncate">
                          {sourceTitle}
                        </p>
                      </div>
                    </div>

                    {!e.isStructural && (
                      <button
                        type="button"
                        disabled={isDeletingId === e.id}
                        onClick={() => handleRemoveEdge(e, reverseLabel)}
                        className="p-1 rounded text-[#71717A] hover:text-red-400 hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove connection"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
