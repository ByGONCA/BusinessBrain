"use client";

// ==============================================================================
// Company Brain: Create Connection Modal
// Establishes directed relationships between any two company objects
// ==============================================================================

import * as React from "react";
import {
  GraphNode,
  GraphEdge,
  RelationshipType,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_LABELS,
  getSuggestedRelationshipTypes,
} from "@/lib/connections/types";
import { createConnectionAction } from "@/lib/connections/actions";
import { cn } from "@/lib/utils";
import {
  X,
  Link2,
  Plus,
  Loader2,
  Search,
  Check,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

interface CreateConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  allNodes: GraphNode[];
  initialSourceNodeId?: string;
  onConnectionCreated?: (edge: GraphEdge) => void;
}

export function CreateConnectionModal({
  isOpen,
  onClose,
  allNodes,
  initialSourceNodeId,
  onConnectionCreated,
}: CreateConnectionModalProps) {
  const [sourceId, setSourceId] = React.useState<string>(initialSourceNodeId || "");
  const [targetId, setTargetId] = React.useState<string>("");
  const [relationshipType, setRelationshipType] = React.useState<RelationshipType>("related_to");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Search filter states
  const [sourceSearch, setSourceSearch] = React.useState("");
  const [targetSearch, setTargetSearch] = React.useState("");
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = React.useState(false);
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = React.useState(false);

  React.useEffect(() => {
    if (initialSourceNodeId) {
      setSourceId(initialSourceNodeId);
    }
  }, [initialSourceNodeId]);

  const sourceNode = React.useMemo(
    () => allNodes.find((n) => n.id === sourceId) || null,
    [allNodes, sourceId]
  );
  const targetNode = React.useMemo(
    () => allNodes.find((n) => n.id === targetId) || null,
    [allNodes, targetId]
  );

  // Compute context-aware suggested relationships
  const suggestedTypes = React.useMemo(() => {
    return getSuggestedRelationshipTypes(sourceNode?.type, targetNode?.type);
  }, [sourceNode?.type, targetNode?.type]);

  // Ensure relationshipType defaults to the top suggested type when nodes change
  React.useEffect(() => {
    if (suggestedTypes.length > 0 && !suggestedTypes.includes(relationshipType)) {
      setRelationshipType(suggestedTypes[0]);
    }
  }, [suggestedTypes, relationshipType]);

  // Filtered nodes for source selection
  const filteredSourceNodes = React.useMemo(() => {
    if (!sourceSearch.trim()) return allNodes.slice(0, 30);
    const q = sourceSearch.toLowerCase();
    return allNodes
      .filter((n) => n.title.toLowerCase().includes(q) || n.type.toLowerCase().includes(q))
      .slice(0, 30);
  }, [allNodes, sourceSearch]);

  // Filtered nodes for target selection (excludes source)
  const filteredTargetNodes = React.useMemo(() => {
    const candidates = allNodes.filter((n) => n.id !== sourceId);
    if (!targetSearch.trim()) return candidates.slice(0, 30);
    const q = targetSearch.toLowerCase();
    return candidates
      .filter((n) => n.title.toLowerCase().includes(q) || n.type.toLowerCase().includes(q))
      .slice(0, 30);
  }, [allNodes, sourceId, targetSearch]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceNode || !targetNode) {
      setErrorMessage("Por favor seleciona o objeto de origem e o objeto de destino.");
      return;
    }
    if (sourceId === targetId) {
      setErrorMessage("Um objeto não pode ser conectado a si próprio.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const res = await createConnectionAction({
      sourceType: sourceNode.type,
      sourceId: sourceNode.id,
      sourceTitle: sourceNode.title,
      targetType: targetNode.type,
      targetId: targetNode.id,
      targetTitle: targetNode.title,
      relationshipType,
    });

    setIsSubmitting(false);

    if (!res.success || !res.connection) {
      setErrorMessage(res.error || "Falha ao criar relação no grafo.");
      return;
    }

    if (onConnectionCreated) {
      const cfg = RELATIONSHIP_LABELS[relationshipType];
      onConnectionCreated({
        id: res.connection.id,
        source: res.connection.source_id,
        sourceType: res.connection.source_type,
        target: res.connection.target_id,
        targetType: res.connection.target_type,
        relationshipType,
        label: cfg.forward,
        reverseLabel: cfg.reverse,
        metadata: res.connection.metadata,
        isStructural: false,
      });
    }

    onClose();
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
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200 dark:border-blue-800">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Criar Relação Explícita
              </h3>
              <p className="text-xs text-zinc-400">
                Conecta dois elementos do Company Brain com tipagem contextual
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Source Node Combobox */}
          <div className="relative">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Origem da Relação
            </label>

            {sourceNode && !isSourceDropdownOpen ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                    {sourceNode.type}
                  </span>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {sourceNode.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSourceDropdownOpen(true);
                    setSourceSearch("");
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline shrink-0 ml-2"
                >
                  Alterar
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={sourceSearch}
                    onChange={(e) => setSourceSearch(e.target.value)}
                    placeholder="Pesquisar elemento de origem por título ou tipo..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus={isSourceDropdownOpen}
                  />
                </div>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-700/50">
                  {filteredSourceNodes.length === 0 ? (
                    <div className="p-3 text-center text-xs text-zinc-400">
                      Nenhum elemento encontrado.
                    </div>
                  ) : (
                    filteredSourceNodes.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setSourceId(n.id);
                          setIsSourceDropdownOpen(false);
                          if (targetId === n.id) setTargetId("");
                        }}
                        className={cn(
                          "flex items-center justify-between p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer text-xs transition-colors",
                          sourceId === n.id && "bg-blue-50/50 dark:bg-blue-950/30"
                        )}
                      >
                        <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                          {n.title}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-zinc-400 ml-2 shrink-0">
                          {n.type}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Target Node Combobox */}
          <div className="relative">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Destino da Relação
            </label>

            {targetNode && !isTargetDropdownOpen ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    {targetNode.type}
                  </span>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {targetNode.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsTargetDropdownOpen(true);
                    setTargetSearch("");
                  }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline shrink-0 ml-2"
                >
                  Alterar
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={targetSearch}
                    onChange={(e) => setTargetSearch(e.target.value)}
                    placeholder="Pesquisar elemento de destino..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-700/50">
                  {filteredTargetNodes.length === 0 ? (
                    <div className="p-3 text-center text-xs text-zinc-400">
                      Nenhum elemento disponível para destino.
                    </div>
                  ) : (
                    filteredTargetNodes.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setTargetId(n.id);
                          setIsTargetDropdownOpen(false);
                        }}
                        className={cn(
                          "flex items-center justify-between p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer text-xs transition-colors",
                          targetId === n.id && "bg-emerald-50/50 dark:bg-emerald-950/30"
                        )}
                      >
                        <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                          {n.title}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-zinc-400 ml-2 shrink-0">
                          {n.type}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. Relationship Type with Context-Aware Suggestions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Tipo de Relação
              </label>
              {sourceNode && targetNode && (
                <span className="text-[10px] text-zinc-400">
                  {sourceNode.type} → {targetNode.type}
                </span>
              )}
            </div>

            <select
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <optgroup label="✨ Sugeridas para este contexto">
                {suggestedTypes.map((type) => {
                  const label = RELATIONSHIP_LABELS[type]?.forward || type;
                  return (
                    <option key={type} value={type}>
                      → {label}
                    </option>
                  );
                })}
              </optgroup>
              <optgroup label="Outras relações do sistema">
                {RELATIONSHIP_TYPES.filter((t) => !suggestedTypes.includes(t)).map((type) => {
                  const label = RELATIONSHIP_LABELS[type]?.forward || type;
                  return (
                    <option key={type} value={type}>
                      → {label}
                    </option>
                  );
                })}
              </optgroup>
            </select>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
              {RELATIONSHIP_LABELS[relationshipType]?.description}
            </p>
          </div>

          {/* 4. Live Visual Preview */}
          {sourceNode && targetNode && (
            <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300">
              <span className="font-semibold block text-[11px] text-blue-500 mb-1">
                Pré-visualização da Conexão:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-800 text-zinc-800 dark:text-zinc-200">
                  {sourceNode.title}
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-mono font-medium flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  {RELATIONSHIP_LABELS[relationshipType]?.forward}
                  <ArrowRight className="h-3 w-3" />
                </span>
                <span className="font-semibold px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-800 text-zinc-800 dark:text-zinc-200">
                  {targetNode.title}
                </span>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !sourceId || !targetId || sourceId === targetId}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>Criar Relação</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
