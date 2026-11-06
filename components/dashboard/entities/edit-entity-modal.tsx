"use client";

import * as React from "react";
import {
  X,
  Loader2,
  Calendar,
  User,
  AlertCircle,
  Trash2,
  Check,
  Tag,
  Clock,
  FileText,
  History,
  Link2,
  Plus,
  ExternalLink,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import {
  CompanyEntity,
  CompanyEntityType,
  WorkspaceMemberOption,
  EntityActivityRecord,
} from "@/lib/entities/types";
import {
  updateCompanyEntityAction,
  deleteCompanyEntityAction,
  getWorkspaceMembersAction,
  getEntityActivityAction,
} from "@/lib/entities/actions";
import {
  getEntityConnectionsAction,
  searchConnectableEntitiesAction,
  createConnectionAction,
  removeConnectionAction,
} from "@/lib/connections/actions";
import {
  CompanyConnectionRecord,
  RelationshipType,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_LABELS,
  EntityType,
} from "@/lib/connections/types";

interface EditEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: CompanyEntity | null;
  onEntityUpdated?: (updated: CompanyEntity) => void;
  onEntityDeleted?: (id: string) => void;
}

type ModalTab = "details" | "history" | "connections";

const STATUS_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  goal: [
    { value: "active", label: "Em Curso (Ativo)" },
    { value: "achieved", label: "Alcançado (Concluído)" },
    { value: "paused", label: "Em Pausa" },
    { value: "at_risk", label: "Em Risco" },
  ],
  decision: [
    { value: "accepted", label: "Aceite / Decidido" },
    { value: "under_review", label: "Em Revisão" },
    { value: "draft", label: "Rascunho" },
    { value: "deprecated", label: "Obsoleto" },
  ],
  task: [
    { value: "todo", label: "A Fazer" },
    { value: "in_progress", label: "Em Progresso" },
    { value: "completed", label: "Concluída" },
  ],
  project: [
    { value: "planning", label: "Planeamento" },
    { value: "active", label: "Ativo" },
    { value: "completed", label: "Concluído" },
    { value: "on_hold", label: "Em Espera" },
  ],
  meeting: [
    { value: "scheduled", label: "Agendada" },
    { value: "completed", label: "Realizada" },
    { value: "cancelled", label: "Cancelada" },
  ],
};

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export function EditEntityModal({
  isOpen,
  onClose,
  entity,
  onEntityUpdated,
  onEntityDeleted,
}: EditEntityModalProps) {
  const [activeTab, setActiveTab] = React.useState<ModalTab>("details");

  // Form states
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [priority, setPriority] = React.useState<"low" | "medium" | "high" | "urgent">("medium");
  const [dueDate, setDueDate] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState<string>("");
  const [members, setMembers] = React.useState<WorkspaceMemberOption[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // History state
  const [activities, setActivities] = React.useState<EntityActivityRecord[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = React.useState(false);

  // Connections state
  const [incomingConnections, setIncomingConnections] = React.useState<CompanyConnectionRecord[]>([]);
  const [outgoingConnections, setOutgoingConnections] = React.useState<CompanyConnectionRecord[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = React.useState(false);
  const [connectionSearchQuery, setConnectionSearchQuery] = React.useState("");
  const [searchCandidates, setSearchCandidates] = React.useState<Array<{ id: string; title: string; type: EntityType }>>([]);
  const [isSearchingCandidates, setIsSearchingCandidates] = React.useState(false);
  const [selectedTarget, setSelectedTarget] = React.useState<{ id: string; title: string; type: EntityType } | null>(null);
  const [selectedRelationship, setSelectedRelationship] = React.useState<RelationshipType>("related_to");
  const [isCreatingConnection, setIsCreatingConnection] = React.useState(false);
  const [connectionActionError, setConnectionActionError] = React.useState<string | null>(null);
  const [connectionSuccessFeedback, setConnectionSuccessFeedback] = React.useState<string | null>(null);

  // Initialize form state when entity opens
  React.useEffect(() => {
    if (entity && isOpen) {
      setTitle(entity.title || "");
      setContent(entity.content || "");
      const meta = entity.metadata || {};
      setNotes((meta.notes as string) || "");
      setStatus((meta.status as string) || (entity.type === "goal" ? "active" : entity.type === "decision" ? "accepted" : "todo"));
      setPriority((meta.priority as "low" | "medium" | "high" | "urgent") || "medium");

      const rawDue = (meta.due_date as string) || (meta.target_date as string) || "";
      if (rawDue) {
        setDueDate(rawDue.split("T")[0]);
      } else {
        setDueDate("");
      }

      setAssigneeId((meta.assignee_id as string) || "");
      setError(null);
      setShowDeleteConfirm(false);
      setActiveTab("details");
      setConnectionActionError(null);
      setConnectionSuccessFeedback(null);

      // Load members
      setIsLoadingMembers(true);
      getWorkspaceMembersAction()
        .then((res) => {
          if (res.success && res.members) {
            setMembers(res.members);
          }
        })
        .finally(() => setIsLoadingMembers(false));

      // Preload connections & activity
      loadConnections(entity.id);
      loadActivities(entity.id);
    }
  }, [entity, isOpen]);

  const loadConnections = async (entityId: string) => {
    setIsLoadingConnections(true);
    try {
      const res = await getEntityConnectionsAction({ entityId });
      if (res.success) {
        setIncomingConnections(res.incoming);
        setOutgoingConnections(res.outgoing);
      }
    } finally {
      setIsLoadingConnections(false);
    }
  };

  const loadActivities = async (entityId: string) => {
    setIsLoadingActivities(true);
    try {
      const res = await getEntityActivityAction(entityId, 40);
      if (res.success && res.activities) {
        setActivities(res.activities);
      }
    } finally {
      setIsLoadingActivities(false);
    }
  };

  // Search candidates for linking
  React.useEffect(() => {
    if (!connectionSearchQuery.trim() || !entity) {
      setSearchCandidates([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingCandidates(true);
      try {
        const res = await searchConnectableEntitiesAction({
          query: connectionSearchQuery,
          excludeId: entity.id,
        });
        if (res.success) {
          setSearchCandidates(res.items);
        }
      } finally {
        setIsSearchingCandidates(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [connectionSearchQuery, entity]);

  // Handle ESC key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSaving && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving, isDeleting, onClose]);

  if (!isOpen || !entity) return null;

  const typeLabelMap: Record<CompanyEntityType, string> = {
    goal: "Objetivo Estratégico",
    decision: "Decisão & ADR",
    task: "Tarefa",
    project: "Projeto",
    meeting: "Reunião",
    person: "Membro",
    document: "Documento",
  };

  const currentStatusOptions = STATUS_OPTIONS[entity.type] || [
    { value: "active", label: "Ativo" },
    { value: "completed", label: "Concluído" },
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("O título é obrigatório.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const selectedMember = members.find((m) => m.id === assigneeId);

    const res = await updateCompanyEntityAction({
      id: entity.id,
      title: title.trim(),
      content: content.trim(),
      notes: notes.trim(),
      status: status || undefined,
      priority,
      dueDate: dueDate ? `${dueDate}T12:00:00.000Z` : null,
      targetDate: dueDate ? `${dueDate}T12:00:00.000Z` : null,
      assigneeId: assigneeId || null,
      assigneeName: selectedMember ? selectedMember.fullName : null,
    });

    setIsSaving(false);

    if (!res.success) {
      setError(res.error || "Falha ao gravar alterações.");
      return;
    }

    if (res.entity && onEntityUpdated) {
      onEntityUpdated(res.entity);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsDeleting(true);
    setError(null);

    const res = await deleteCompanyEntityAction(entity.id);
    setIsDeleting(false);

    if (!res.success) {
      setError(res.error || "Falha ao eliminar registo.");
      return;
    }

    if (onEntityDeleted) {
      onEntityDeleted(entity.id);
    }
    onClose();
  };

  const handleCreateConnection = async () => {
    if (!selectedTarget) return;

    setIsCreatingConnection(true);
    setConnectionActionError(null);
    setConnectionSuccessFeedback(null);

    const res = await createConnectionAction({
      sourceType: entity.type as EntityType,
      sourceId: entity.id,
      sourceTitle: entity.title,
      targetType: selectedTarget.type,
      targetId: selectedTarget.id,
      targetTitle: selectedTarget.title,
      relationshipType: selectedRelationship,
    });

    setIsCreatingConnection(false);

    if (!res.success) {
      setConnectionActionError(res.error || "Erro ao criar associação.");
      return;
    }

    setConnectionSuccessFeedback(`Associação com "${selectedTarget.title}" registada com sucesso.`);
    setSelectedTarget(null);
    setConnectionSearchQuery("");
    await loadConnections(entity.id);
    await loadActivities(entity.id);
  };

  const handleRemoveConnection = async (connId: string) => {
    setConnectionActionError(null);
    setConnectionSuccessFeedback(null);
    const res = await removeConnectionAction(connId);
    if (!res.success) {
      setConnectionActionError(res.error || "Erro ao remover associação.");
      return;
    }
    setConnectionSuccessFeedback("Associação removida com sucesso.");
    await loadConnections(entity.id);
    await loadActivities(entity.id);
  };

  const getEntityUrl = (type: string, id: string) => {
    if (type === "page") return `/dashboard/pages/${id}`;
    if (type === "task") return `/dashboard/tasks`;
    if (type === "goal") return `/dashboard/goals`;
    if (type === "project") return `/dashboard/projects`;
    if (type === "decision") return `/dashboard/decisions`;
    return `/dashboard`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-secondary">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {typeLabelMap[entity.type]}
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
              {entity.title}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-6 border-b border-border bg-surface-secondary/50 gap-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "details"
                ? "border-zinc-100 text-foreground"
                : "border-transparent text-muted-foreground hover:text-zinc-200"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Editar Detalhes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("connections")}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "connections"
                ? "border-zinc-100 text-foreground"
                : "border-transparent text-muted-foreground hover:text-zinc-200"
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>Conexões</span>
            {(incomingConnections.length > 0 || outgoingConnections.length > 0) && (
              <span className="ml-1 px-1.5 py-0.2 rounded-md bg-white/[0.08] text-[10px] text-muted-foreground">
                {incomingConnections.length + outgoingConnections.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-zinc-100 text-foreground"
                : "border-transparent text-muted-foreground hover:text-zinc-200"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Histórico de Alterações</span>
            {activities.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-md bg-white/[0.08] text-[10px] text-muted-foreground">
                {activities.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Details / Edit Form */}
        {activeTab === "details" && (
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Título</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Definir nova arquitetura de dados"
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs text-foreground placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400"
              />
            </div>

            {/* Status & Priority Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Estado Atual</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs text-foreground focus:outline-none focus:border-zinc-400 capitalize"
                >
                  {currentStatusOptions.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Prioridade</span>
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high" | "urgent")}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs text-foreground focus:outline-none focus:border-zinc-400"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due Date & Assignee Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{entity.type === "goal" ? "Data Limite Alvo" : "Prazo / Data"}</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs text-foreground focus:outline-none focus:border-zinc-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Responsável</span>
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={isLoadingMembers}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs text-foreground focus:outline-none focus:border-zinc-400 disabled:opacity-50"
                >
                  <option value="">(Não atribuído)</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Content / Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Descrição / Contexto
              </label>
              <textarea
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Detalhes ou critérios de aceitação..."
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs text-foreground placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 resize-none"
              />
            </div>

            {/* Internal Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Notas & Decisões Complementares
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionais sobre trade-offs ou progresso..."
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs text-foreground placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 resize-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleDelete}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-rose-500 transition-colors"
                    >
                      {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar Eliminação"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2 py-1.5 text-xs text-muted-foreground hover:text-zinc-200"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-rose-400 transition-colors py-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Eliminar</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving || isDeleting}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-hover transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isDeleting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 text-zinc-950 px-4 py-1.5 text-xs font-semibold hover:bg-white transition-colors disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Guardar Alterações</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: Connections */}
        {activeTab === "connections" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {connectionSuccessFeedback && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center justify-between p-3 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
              >
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{connectionSuccessFeedback}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setConnectionSuccessFeedback(null)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {connectionActionError && (
              <div
                role="alert"
                className="flex items-center justify-between p-3 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{connectionActionError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setConnectionActionError(null)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Create new association section */}
            <div className="p-4 rounded-xl border border-border bg-background text-foreground space-y-3">
              <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Adicionar Nova Ligação no Grafo</span>
              </h4>

              {/* Search target input */}
              <div className="relative">
                <input
                  type="text"
                  value={connectionSearchQuery}
                  onChange={(e) => setConnectionSearchQuery(e.target.value)}
                  placeholder="Pesquisar página, tarefa, projeto ou objetivo para ligar..."
                  className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-xs text-foreground placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400"
                />
                {isSearchingCandidates && (
                  <Loader2 className="absolute right-3 top-2.5 h-3.5 w-3.5 text-zinc-500 animate-spin" />
                )}

                {/* Candidate Dropdown */}
                {searchCandidates.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-20 max-h-48 overflow-y-auto rounded-lg border border-white/[0.1] bg-[#1a1c22] shadow-xl p-1 space-y-0.5">
                    {searchCandidates.map((cand) => (
                      <button
                        key={`${cand.type}-${cand.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedTarget(cand);
                          setSearchCandidates([]);
                          setConnectionSearchQuery(cand.title);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-left text-zinc-200 hover:bg-white/[0.08] transition-colors"
                      >
                        <span className="font-medium truncate">{cand.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-hover text-muted-foreground uppercase">
                          {cand.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedTarget && (
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <div className="flex-1 w-full flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="text-muted-foreground">Relação:</span>
                    <select
                      value={selectedRelationship}
                      onChange={(e) => setSelectedRelationship(e.target.value as RelationshipType)}
                      className="flex-1 rounded-lg border border-border bg-surface-secondary px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-zinc-400"
                    >
                      {RELATIONSHIP_TYPES.map((rel) => (
                        <option key={rel} value={rel}>
                          {RELATIONSHIP_LABELS[rel]?.forward || rel}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={isCreatingConnection}
                    onClick={handleCreateConnection}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-100 text-zinc-950 px-3 py-1.5 text-xs font-semibold hover:bg-white transition-colors disabled:opacity-50"
                  >
                    {isCreatingConnection ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                    <span>Associar</span>
                  </button>
                </div>
              )}
            </div>

            {/* Active Connections List */}
            <div className="space-y-4">
              {isLoadingConnections ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
                </div>
              ) : outgoingConnections.length === 0 && incomingConnections.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-xl p-4">
                  <Link2 className="h-6 w-6 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">Nenhuma ligação registada</p>
                  <p className="text-[11px] text-zinc-500 max-w-sm mx-auto mt-1">
                    Conecta este elemento com páginas, projetos, tarefas ou decisões para criar a memória interligada da empresa.
                  </p>
                </div>
              ) : (
                <>
                  {/* Outgoing Connections */}
                  {outgoingConnections.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Ligações de Saída ({outgoingConnections.length})
                      </h5>
                      <div className="space-y-1.5">
                        {outgoingConnections.map((conn) => {
                          const relCfg = RELATIONSHIP_LABELS[conn.relationship_type] || RELATIONSHIP_LABELS.related_to;
                          return (
                            <div
                              key={conn.id}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-surface-secondary border border-border text-xs hover:border-border-strong transition-colors"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <span className="px-1.5 py-0.5 rounded-md bg-hover text-[10px] text-muted-foreground font-mono">
                                  {relCfg.forward}
                                </span>
                                <ArrowRight className="h-3 w-3 text-zinc-600 shrink-0" />
                                <Link
                                  href={getEntityUrl(conn.target_type, conn.target_id)}
                                  className="text-zinc-200 hover:text-indigo-400 font-medium truncate flex items-center gap-1"
                                >
                                  <span>{conn.target_title || "Elemento sem título"}</span>
                                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                                </Link>
                                <span className="text-[10px] px-1 rounded-md bg-surface-secondary text-zinc-500 uppercase">
                                  {conn.target_type}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveConnection(conn.id)}
                                className="text-zinc-500 hover:text-rose-400 p-1 rounded-md hover:bg-surface-secondary transition-colors"
                                title="Remover ligação"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Incoming Connections */}
                  {incomingConnections.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Ligações de Entrada ({incomingConnections.length})
                      </h5>
                      <div className="space-y-1.5">
                        {incomingConnections.map((conn) => {
                          const relCfg = RELATIONSHIP_LABELS[conn.relationship_type] || RELATIONSHIP_LABELS.related_to;
                          return (
                            <div
                              key={conn.id}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-surface-secondary border border-border text-xs hover:border-border-strong transition-colors"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <Link
                                  href={getEntityUrl(conn.source_type, conn.source_id)}
                                  className="text-zinc-200 hover:text-indigo-400 font-medium truncate flex items-center gap-1"
                                >
                                  <span>{conn.source_title || "Elemento sem título"}</span>
                                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                                </Link>
                                <span className="text-[10px] px-1 rounded-md bg-surface-secondary text-zinc-500 uppercase">
                                  {conn.source_type}
                                </span>
                                <ArrowRight className="h-3 w-3 text-zinc-600 shrink-0" />
                                <span className="px-1.5 py-0.5 rounded-md bg-hover text-[10px] text-muted-foreground font-mono">
                                  {relCfg.reverse}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveConnection(conn.id)}
                                className="text-zinc-500 hover:text-rose-400 p-1 rounded-md hover:bg-surface-secondary transition-colors"
                                title="Remover ligação"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: History / Audit Trail */}
        {activeTab === "history" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isLoadingActivities ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border rounded-xl p-4">
                <History className="h-6 w-6 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground font-medium">Sem histórico recente registado</p>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto mt-1">
                  As alterações de estado, prazo, prioridade e conteúdo são registadas automaticamente para garantir a rastreabilidade organizacional.
                </p>
              </div>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-white/[0.08]">
                {activities.map((act) => {
                  const dateStr = new Date(act.created_at).toLocaleString();
                  const changes = act.changes || {};

                  return (
                    <div key={act.id} className="relative pl-7 text-xs">
                      {/* Bullet node */}
                      <span className="absolute left-2.5 top-1.5 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-zinc-700 border-2 border-[#16181D]" />

                      <div className="p-3 rounded-xl bg-surface-secondary border border-border space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-zinc-200">
                            {act.actor_name || "Membro da Equipa"}
                          </span>
                          <span className="text-zinc-500">{dateStr}</span>
                        </div>

                        <p className="text-muted-foreground text-xs">
                          {act.action === "entity_created" && "Criou este registo."}
                          {act.action === "status_changed" && "Alterou o estado."}
                          {act.action === "priority_changed" && "Alterou a prioridade."}
                          {act.action === "due_date_changed" && "Atualizou o prazo / data."}
                          {act.action === "assignee_changed" && "Alterou a atribuição."}
                          {act.action === "content_updated" && "Editou o conteúdo / descrição."}
                          {act.action === "details_updated" && "Atualizou os detalhes gerais."}
                          {act.action === "entity_deleted" && "Eliminou o registo."}
                        </p>

                        {/* Visual field transitions */}
                        {Object.keys(changes).length > 0 && (
                          <div className="pt-1.5 mt-1 border-t border-white/[0.04] space-y-1">
                            {Object.entries(changes).map(([field, delta]) => (
                              <div key={field} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="font-mono text-zinc-500 capitalize">{field.replace(/_/g, " ")}:</span>
                                {delta.old !== null && delta.old !== undefined ? (
                                  <span className="line-through text-zinc-500">
                                    {String(delta.old)}
                                  </span>
                                ) : (
                                  <span className="text-zinc-600">(nenhum)</span>
                                )}
                                <ArrowRight className="h-2.5 w-2.5 text-zinc-600" />
                                <span className="font-medium text-emerald-400">
                                  {String(delta.new || "(removido)")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
