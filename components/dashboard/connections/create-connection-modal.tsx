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
} from "@/lib/connections/types";
import { createConnectionAction } from "@/lib/connections/actions";
import { cn } from "@/lib/utils";
import {
  X,
  Link2,
  Plus,
  Loader2,
  CheckCircle2,
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

  React.useEffect(() => {
    if (initialSourceNodeId) {
      setSourceId(initialSourceNodeId);
    }
  }, [initialSourceNodeId]);

  if (!isOpen) return null;

  const sourceNode = allNodes.find((n) => n.id === sourceId);
  const targetNode = allNodes.find((n) => n.id === targetId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceNode || !targetNode) {
      setErrorMessage("Please select both source and target objects.");
      return;
    }
    if (sourceId === targetId) {
      setErrorMessage("An object cannot be connected to itself.");
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
      setErrorMessage(res.error || "Failed to create connection");
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
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200 dark:border-blue-800">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Create Relationship
              </h3>
              <p className="text-xs text-zinc-400">
                Link two company objects in the graph
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
              {errorMessage}
            </div>
          )}

          {/* Source Node */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Source Object
            </label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Source Object...</option>
              {allNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  [{n.type.toUpperCase()}] {n.title}
                </option>
              ))}
            </select>
          </div>

          {/* Relationship Type */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Relationship Type
            </label>
            <select
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RELATIONSHIP_TYPES.map((type) => {
                const label = RELATIONSHIP_LABELS[type]?.forward || type;
                return (
                  <option key={type} value={type}>
                    → {label}
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-zinc-400 mt-1">
              {RELATIONSHIP_LABELS[relationshipType]?.description}
            </p>
          </div>

          {/* Target Node */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Target Object
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Target Object...</option>
              {allNodes
                .filter((n) => n.id !== sourceId)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    [{n.type.toUpperCase()}] {n.title}
                  </option>
                ))}
            </select>
          </div>

          {/* Preview of relationship */}
          {sourceNode && targetNode && (
            <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300">
              <span className="font-semibold">{sourceNode.title}</span>
              <span className="mx-1 text-blue-500 font-mono">
                → {RELATIONSHIP_LABELS[relationshipType]?.forward} →
              </span>
              <span className="font-semibold">{targetNode.title}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !sourceId || !targetId}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>Create Connection</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
