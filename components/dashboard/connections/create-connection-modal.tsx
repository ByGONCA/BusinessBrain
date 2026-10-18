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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl bg-[#141415] border border-[#242427] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#242427] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Criar Relação Explícita
              </h3>
              <p className="text-xs text-[#71717A]">
                Conecta dois elementos do Company Brain com tipagem contextual
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#71717A] hover:text-foreground hover:bg-[#1C1C1F] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/30 border border-red-800 text-xs text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Source Node Combobox */}
          <div className="relative">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#71717A] mb-1">
              Origem da Relação
            </label>

            {sourceNode && !isSourceDropdownOpen ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-[#242427] bg-[#19191B]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-950/60 text-blue-300 border border-blue-800/50">
                    {sourceNode.type}
                  </span>
                  <span className="text-xs font-semibold text-foreground truncate">
                    {sourceNode.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSourceDropdownOpen(true);
                    setSourceSearch("");
                  }}
                  className="text-xs text-blue-400 font-medium hover:underline shrink-0 ml-2"
                >
                  Alterar
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#71717A]" />
                  <input
                    type="text"
                    value={sourceSearch}
                    onChange={(e) => setSourceSearch(e.target.value)}
                    placeholder="Pesquisar elemento de origem por título ou tipo..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-[#19191B] border border-[#242427] text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    autoFocus={isSourceDropdownOpen}
                  />
                </div>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-[#242427] bg-[#19191B] divide-y divide-[#242427]">
                  {filteredSourceNodes.length === 0 ? (
                    <div className="p-3 text-center text-xs text-[#71717A]">
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
                          "flex items-center justify-between p-2 hover:bg-[#202023] cursor-pointer text-xs transition-colors",
                          sourceId === n.id && "bg-[#242427]"
                        )}
                      >
                        <span className="truncate font-medium text-foreground">
                          {n.title}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-[#71717A] ml-2 shrink-0">
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
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#71717A] mb-1">
              Destino da Relação
            </label>

            {targetNode && !isTargetDropdownOpen ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-[#242427] bg-[#19191B]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                    {targetNode.type}
                  </span>
                  <span className="text-xs font-semibold text-foreground truncate">
                    {targetNode.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsTargetDropdownOpen(true);
                    setTargetSearch("");
                  }}
                  className="text-xs text-emerald-400 font-medium hover:underline shrink-0 ml-2"
                >
                  Alterar
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#71717A]" />
                  <input
                    type="text"
                    value={targetSearch}
                    onChange={(e) => setTargetSearch(e.target.value)}
                    placeholder="Pesquisar elemento de destino..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-[#19191B] border border-[#242427] text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-[#242427] bg-[#19191B] divide-y divide-[#242427]">
                  {filteredTargetNodes.length === 0 ? (
                    <div className="p-3 text-center text-xs text-[#71717A]">
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
                          "flex items-center justify-between p-2 hover:bg-[#202023] cursor-pointer text-xs transition-colors",
                          targetId === n.id && "bg-[#242427]"
                        )}
                      >
                        <span className="truncate font-medium text-foreground">
                          {n.title}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-[#71717A] ml-2 shrink-0">
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
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#71717A]">
                Tipo de Relação
              </label>
              {sourceNode && targetNode && (
                <span className="text-[10px] text-[#71717A]">
                  {sourceNode.type} → {targetNode.type}
                </span>
              )}
            </div>

            <select
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-[#19191B] border border-[#242427] text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              <optgroup label="✨ Sugeridas para este contexto" className="bg-[#141415] text-foreground">
                {suggestedTypes.map((type) => {
                  const label = RELATIONSHIP_LABELS[type]?.forward || type;
                  return (
                    <option key={type} value={type}>
                      → {label}
                    </option>
                  );
                })}
              </optgroup>
              <optgroup label="Outras relações do sistema" className="bg-[#141415] text-foreground">
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
            <p className="text-[11px] text-[#71717A] mt-1.5 leading-relaxed">
              {RELATIONSHIP_LABELS[relationshipType]?.description}
            </p>
          </div>

          {/* 4. Live Visual Preview */}
          {sourceNode && targetNode && (
            <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-900/40 text-xs text-blue-300">
              <span className="font-semibold block text-[11px] text-blue-400 mb-1">
                Pré-visualização da Conexão:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold px-2 py-0.5 rounded bg-[#19191B] border border-blue-800/40 text-foreground">
                  {sourceNode.title}
                </span>
                <span className="text-blue-400 font-mono font-medium flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  {RELATIONSHIP_LABELS[relationshipType]?.forward}
                  <ArrowRight className="h-3 w-3" />
                </span>
                <span className="font-semibold px-2 py-0.5 rounded bg-[#19191B] border border-blue-800/40 text-foreground">
                  {targetNode.title}
                </span>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242427]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-xs font-medium text-[#71717A] hover:text-foreground hover:bg-[#1C1C1F] transition-colors"
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
