"use client";

import * as React from "react";
import {
  Search,
  Filter,
  ArrowUpDown,
  Calendar,
  User,
  Plus,
  X,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Edit2,
  LayoutGrid,
  Table as TableIcon,
  Kanban as KanbanIcon,
  ArrowRight,
  MoreHorizontal,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompanyEntity, CompanyEntityType, EntityViewMode } from "@/lib/entities/types";
import { updateCompanyEntityAction } from "@/lib/entities/actions";
import { EditEntityModal } from "./edit-entity-modal";
import { FilterDropdownButton, FilterOption } from "./filter-dropdown-button";

interface EntityExplorerProps {
  initialEntities: CompanyEntity[];
  entityType: CompanyEntityType;
  title: string;
  createButtonText?: string;
  onOpenCreate?: () => void;
  icon: React.ComponentType<{ className?: string }>;
}

type SortOption = "date_desc" | "date_asc" | "title_asc" | "title_desc" | "due_soon" | "priority_desc";

// Canonical status definitions per entity type
export const KANBAN_COLUMNS: Record<CompanyEntityType, Array<{ id: string; label: string }>> = {
  goal: [
    { id: "active", label: "Em Curso" },
    { id: "at_risk", label: "Em Risco" },
    { id: "paused", label: "Em Pausa" },
    { id: "achieved", label: "Alcançado" },
  ],
  decision: [
    { id: "draft", label: "Rascunho" },
    { id: "under_review", label: "Em Revisão" },
    { id: "accepted", label: "Aceite" },
    { id: "deprecated", label: "Obsoleto" },
  ],
  task: [
    { id: "todo", label: "A Fazer" },
    { id: "in_progress", label: "Em Progresso" },
    { id: "completed", label: "Concluída" },
  ],
  project: [
    { id: "planning", label: "Planeamento" },
    { id: "active", label: "Ativo" },
    { id: "on_hold", label: "Em Espera" },
    { id: "completed", label: "Concluído" },
  ],
  meeting: [
    { id: "scheduled", label: "Agendada" },
    { id: "completed", label: "Realizada" },
    { id: "cancelled", label: "Cancelada" },
  ],
  person: [{ id: "active", label: "Ativo" }],
  document: [{ id: "active", label: "Ativo" }],
};

export const VALID_VIEW_MODES: ReadonlySet<string> = new Set<EntityViewMode>(["cards", "table", "kanban"]);

/**
 * Safe local storage reader that strictly validates the view mode and catches Quota/Security errors.
 */
export function getSafeViewPreference(entityType: string, defaultMode: EntityViewMode = "cards"): EntityViewMode {
  if (typeof window === "undefined") return defaultMode;
  try {
    const raw = window.localStorage.getItem(`cb_view_${entityType}`);
    if (raw && VALID_VIEW_MODES.has(raw)) {
      return raw as EntityViewMode;
    }
  } catch {
    // Storage access blocked or unavailable
  }
  return defaultMode;
}

export function EntityExplorer({
  initialEntities,
  entityType,
  title,
  createButtonText = "Criar",
  onOpenCreate,
  icon: EntityIcon,
}: EntityExplorerProps) {
  const [entities, setEntities] = React.useState<CompanyEntity[]>(initialEntities);
  const [viewMode, setViewMode] = React.useState<EntityViewMode>("cards");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<SortOption>("date_desc");
  const [editingEntity, setEditingEntity] = React.useState<CompanyEntity | null>(null);

  // Optimistic mutation tracking & feedback
  const [pendingMoveIds, setPendingMoveIds] = React.useState<Set<string>>(new Set());
  const [mutationFeedback, setMutationFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Restore validated view preference from storage safely
  React.useEffect(() => {
    const preferred = getSafeViewPreference(entityType, "cards");
    setViewMode(preferred);
  }, [entityType]);

  const handleViewChange = (mode: EntityViewMode) => {
    setViewMode(mode);
    try {
      window.localStorage.setItem(`cb_view_${entityType}`, mode);
    } catch {
      // Safe fallback if storage quota exceeded or disabled
    }
  };

  // Sync state if server passes updated initialEntities
  React.useEffect(() => {
    setEntities(initialEntities);
  }, [initialEntities]);

  // Priority mapping for sorting
  const priorityWeight: Record<string, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  // Filter and sort computation
  const filteredAndSorted = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return entities
      .filter((item) => {
        const meta = item.metadata || {};
        // 1. Text search
        if (q) {
          const matchTitle = (item.title || "").toLowerCase().includes(q);
          const matchContent = (item.content || "").toLowerCase().includes(q);
          const matchNotes = ((meta.notes as string) || "").toLowerCase().includes(q);
          const matchAssignee = ((meta.assignee_name as string) || "").toLowerCase().includes(q);
          if (!matchTitle && !matchContent && !matchNotes && !matchAssignee) {
            return false;
          }
        }

        // 2. Status filter
        if (statusFilter !== "all") {
          const itemStatus = (meta.status as string) || "active";
          if (itemStatus !== statusFilter) {
            return false;
          }
        }

        // 3. Priority filter
        if (priorityFilter !== "all") {
          const itemPriority = (meta.priority as string) || "medium";
          if (itemPriority !== priorityFilter) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const aMeta = a.metadata || {};
        const bMeta = b.metadata || {};

        if (sortBy === "date_asc") {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortBy === "date_desc") {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortBy === "title_asc") {
          return (a.title || "").localeCompare(b.title || "");
        }
        if (sortBy === "title_desc") {
          return (b.title || "").localeCompare(a.title || "");
        }
        if (sortBy === "priority_desc") {
          const aP = priorityWeight[(aMeta.priority as string) || "medium"] || 0;
          const bP = priorityWeight[(bMeta.priority as string) || "medium"] || 0;
          return bP - aP;
        }
        if (sortBy === "due_soon") {
          const aDate = (aMeta.due_date as string) || (aMeta.target_date as string) || "9999";
          const bDate = (bMeta.due_date as string) || (bMeta.target_date as string) || "9999";
          return aDate.localeCompare(bDate);
        }
        return 0;
      });
  }, [entities, searchQuery, statusFilter, priorityFilter, sortBy]);

  const hasActiveFilters = searchQuery !== "" || statusFilter !== "all" || priorityFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setSortBy("date_desc");
  };

  const handleEntityUpdated = (updated: CompanyEntity) => {
    setEntities((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  };

  const handleEntityDeleted = (id: string) => {
    setEntities((prev) => prev.filter((e) => e.id !== id));
  };

  // Move item between Kanban columns with optimistic update, concurrency lock and rollback
  const handleMoveKanban = async (entity: CompanyEntity, newStatus: string) => {
    if (pendingMoveIds.has(entity.id)) {
      return; // Prevent concurrent in-flight mutations on the same card
    }

    const previousStatus = entity.metadata?.status;
    if (previousStatus === newStatus) return;

    // 1. Mark as pending and apply optimistic update
    setPendingMoveIds((prev) => new Set(prev).add(entity.id));
    setMutationFeedback(null);

    const previousEntities = [...entities];
    const updatedMetadata = { ...entity.metadata, status: newStatus };
    const optimistic = { ...entity, metadata: updatedMetadata };

    setEntities((prev) => prev.map((e) => (e.id === entity.id ? optimistic : e)));

    try {
      const res = await updateCompanyEntityAction({
        id: entity.id,
        status: newStatus,
      });

      if (!res.success) {
        // Rollback optimistic update
        setEntities(previousEntities);
        setMutationFeedback({
          type: "error",
          message: res.error || "Não foi possível atualizar o estado no servidor. O item foi restaurado.",
        });
      } else {
        setMutationFeedback({
          type: "success",
          message: `Estado atualizado com sucesso para "${newStatus.replace(/_/g, " ")}".`,
        });
      }
    } catch {
      // Rollback on unexpected failure
      setEntities(previousEntities);
      setMutationFeedback({
        type: "error",
        message: "Ocorreu um erro de rede. O estado anterior foi restaurado.",
      });
    } finally {
      setPendingMoveIds((prev) => {
        const next = new Set(prev);
        next.delete(entity.id);
        return next;
      });
    }
  };

  // Derive unique statuses present in data
  const availableStatuses = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of entities) {
      if (e.metadata?.status) {
        set.add(String(e.metadata.status));
      }
    }
    return Array.from(set);
  }, [entities]);

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const getPriorityBadgeVariant = (priority?: string) => {
    switch (priority) {
      case "urgent":
        return "border-rose-500/30 text-rose-400 bg-rose-500/10";
      case "high":
        return "border-amber-500/30 text-amber-400 bg-amber-500/10";
      case "medium":
        return "border-blue-500/30 text-blue-400 bg-blue-500/10";
      case "low":
      default:
        return "border-zinc-500/30 text-zinc-400 bg-zinc-500/10";
    }
  };

  const kanbanColumns = KANBAN_COLUMNS[entityType] || [
    { id: "active", label: "Ativo" },
    { id: "completed", label: "Concluído" },
  ];

  // Options for intuitive FilterDropdownButtons
  const statusOptions: FilterOption[] = React.useMemo(() => {
    const list: FilterOption[] = [
      { value: "all", label: "Todos os estados" },
    ];
    const added = new Set<string>(["all"]);

    for (const col of kanbanColumns) {
      list.push({ value: col.id, label: col.label });
      added.add(col.id);
    }

    for (const st of availableStatuses) {
      if (!added.has(st)) {
        list.push({
          value: st,
          label: st.charAt(0).toUpperCase() + st.slice(1).replace(/_/g, " "),
        });
        added.add(st);
      }
    }
    return list;
  }, [kanbanColumns, availableStatuses]);

  const priorityOptions: FilterOption[] = React.useMemo(
    () => [
      { value: "all", label: "Todas as prioridades" },
      { value: "urgent", label: "Urgente" },
      { value: "high", label: "Alta" },
      { value: "medium", label: "Média" },
      { value: "low", label: "Baixa" },
    ],
    []
  );

  const sortOptions: FilterOption[] = React.useMemo(
    () => [
      { value: "date_desc", label: "Mais Recente" },
      { value: "date_asc", label: "Mais Antigo" },
      { value: "title_asc", label: "Título (A-Z)" },
      { value: "title_desc", label: "Título (Z-A)" },
      { value: "priority_desc", label: "Prioridade Alta" },
      { value: "due_soon", label: "Prazo Mais Próximo" },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {/* Toast Feedback for Optimistic Action Results */}
      {mutationFeedback && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between p-3 rounded-xl border text-xs animate-in fade-in slide-in-from-top-1 duration-200 ${
            mutationFeedback.type === "error"
              ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {mutationFeedback.type === "error" ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            )}
            <span>{mutationFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setMutationFeedback(null)}
            className="p-1 rounded-md hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fechar notificação"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Search, Filter, Sort & View Switcher Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card/60 border border-border p-3 rounded-xl">
        {/* Left: Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Pesquisar ${title.toLowerCase()}...`}
            aria-label={`Pesquisar ${title.toLowerCase()}`}
            className="w-full rounded-lg border border-border bg-background pl-8 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 dark:focus:ring-zinc-500 dark:focus:border-zinc-500 transition-shadow"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Limpar texto de pesquisa"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-zinc-400"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Right: Filters, Sorters & View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter Button */}
          <FilterDropdownButton
            label="Estado"
            value={statusFilter}
            options={statusOptions}
            onChange={setStatusFilter}
            icon={Filter}
            defaultValue="all"
          />

          {/* Priority Filter Button */}
          <FilterDropdownButton
            label="Prioridade"
            value={priorityFilter}
            options={priorityOptions}
            onChange={setPriorityFilter}
            icon={AlertCircle}
            defaultValue="all"
          />

          {/* Sort By Filter Button */}
          <FilterDropdownButton
            label="Ordenar"
            value={sortBy}
            options={sortOptions}
            onChange={(val) => setSortBy(val as SortOption)}
            icon={ArrowUpDown}
            defaultValue="date_desc"
          />

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors cursor-pointer"
            >
              Limpar
            </button>
          )}

          {/* View Mode Segmented Control with Accessible ARIA Radio Group Semantics */}
          <div
            role="radiogroup"
            aria-label="Modo de visualização"
            className="flex items-center border border-border rounded-lg p-0.5 bg-background shrink-0"
          >
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === "cards"}
              aria-label="Visualização em cartões"
              onClick={() => handleViewChange("cards")}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-zinc-400 ${
                viewMode === "cards"
                  ? "bg-secondary text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vista em Cartões"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === "table"}
              aria-label="Visualização em tabela"
              onClick={() => handleViewChange("table")}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-zinc-400 ${
                viewMode === "table"
                  ? "bg-secondary text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vista em Tabela"
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === "kanban"}
              aria-label="Visualização em Kanban"
              onClick={() => handleViewChange("kanban")}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-zinc-400 ${
                viewMode === "kanban"
                  ? "bg-secondary text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vista Kanban"
            >
              <KanbanIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area based on View Mode */}
      {filteredAndSorted.length > 0 ? (
        <>
          {/* VIEW 1: Cards View */}
          {viewMode === "cards" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredAndSorted.map((item) => {
                const meta = item.metadata || {};
                const itemStatus = (meta.status as string) || "active";
                const itemPriority = (meta.priority as string) || "medium";
                const dueDateFormatted = formatDueDate((meta.due_date as string) || (meta.target_date as string));
                const assignee = (meta.assignee_name as string) || null;

                return (
                  <Card
                    key={item.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Editar ${item.title}`}
                    onClick={() => setEditingEntity(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setEditingEntity(item);
                      }
                    }}
                    className="group cursor-pointer p-4 bg-card border-border hover:border-zinc-500/40 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 transition-all shadow-xs relative"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-secondary text-foreground border border-border shrink-0 mt-0.5 group-hover:border-zinc-500/30 transition-colors">
                          <EntityIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground group-hover:text-indigo-400 dark:group-hover:text-indigo-300 transition-colors line-clamp-1">
                            {item.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                            {dueDateFormatted && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{dueDateFormatted}</span>
                              </span>
                            )}
                            {assignee && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>{assignee}</span>
                              </span>
                            )}
                            {!dueDateFormatted && !assignee && (
                              <span>Criado em {new Date(item.created_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status & Priority Badges */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {itemStatus.replace(/_/g, " ")}
                        </Badge>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border capitalize ${getPriorityBadgeVariant(
                            itemPriority
                          )}`}
                        >
                          {itemPriority}
                        </span>
                      </div>
                    </div>

                    {item.content && (
                      <p className="mt-2.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.content}
                      </p>
                    )}

                    {meta.notes && (
                      <div className="mt-2 pt-2 border-t border-border/60 text-[11px] text-zinc-400 dark:text-zinc-500 line-clamp-1 flex items-center gap-1">
                        <FileText className="h-3 w-3 shrink-0" />
                        <span>{meta.notes as string}</span>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* VIEW 2: Table View */}
          {viewMode === "table" && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto min-w-full">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Título</th>
                      <th className="py-3 px-3">Estado</th>
                      <th className="py-3 px-3">Prioridade</th>
                      <th className="py-3 px-3">Data / Prazo</th>
                      <th className="py-3 px-3">Responsável</th>
                      <th className="py-3 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredAndSorted.map((item) => {
                      const meta = item.metadata || {};
                      const itemStatus = (meta.status as string) || "active";
                      const itemPriority = (meta.priority as string) || "medium";
                      const dueDateFormatted = formatDueDate((meta.due_date as string) || (meta.target_date as string));
                      const assignee = (meta.assignee_name as string) || "—";

                      return (
                        <tr
                          key={item.id}
                          tabIndex={0}
                          role="button"
                          aria-label={`Editar ${item.title}`}
                          onClick={() => setEditingEntity(item)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setEditingEntity(item);
                            }
                          }}
                          className="hover:bg-muted/40 cursor-pointer focus:outline-none focus:bg-muted/60 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium text-foreground max-w-xs truncate">
                            <div className="flex items-center gap-2">
                              <EntityIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate">{item.title}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {itemStatus.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border capitalize inline-block ${getPriorityBadgeVariant(
                                itemPriority
                              )}`}
                            >
                              {itemPriority}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground font-mono text-[11px]">
                            {dueDateFormatted || "—"}
                          </td>
                          <td className="py-3 px-3 text-muted-foreground">
                            {assignee}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              aria-label={`Editar ${item.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEntity(item);
                              }}
                              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 3: Kanban View */}
          {viewMode === "kanban" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
              {kanbanColumns.map((col) => {
                const columnItems = filteredAndSorted.filter((e) => {
                  const st = (e.metadata?.status as string) || (entityType === "goal" ? "active" : entityType === "decision" ? "accepted" : "todo");
                  return st === col.id;
                });

                return (
                  <div
                    key={col.id}
                    className="flex flex-col bg-card/40 border border-border rounded-xl p-3 min-h-[360px]"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                          {col.label}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-md bg-muted text-[10px] font-mono text-muted-foreground">
                          {columnItems.length}
                        </span>
                      </div>
                    </div>

                    {/* Column Items */}
                    <div className="flex-1 space-y-2.5 overflow-y-auto">
                      {columnItems.length === 0 ? (
                        <div className="h-24 flex items-center justify-center border border-dashed border-border/60 rounded-lg text-[11px] text-muted-foreground">
                          Sem itens
                        </div>
                      ) : (
                        columnItems.map((item) => {
                          const meta = item.metadata || {};
                          const itemPriority = (meta.priority as string) || "medium";
                          const dueDateFormatted = formatDueDate((meta.due_date as string) || (meta.target_date as string));
                          const isPending = pendingMoveIds.has(item.id);

                          return (
                            <div
                              key={item.id}
                              tabIndex={0}
                              role="button"
                              aria-label={`Editar ${item.title}`}
                              onClick={() => setEditingEntity(item)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setEditingEntity(item);
                                }
                              }}
                              className={`p-3 bg-card border border-border hover:border-zinc-500/40 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 rounded-lg cursor-pointer transition-all shadow-2xs space-y-2 relative ${
                                isPending ? "opacity-70 pointer-events-none" : ""
                              }`}
                            >
                              {isPending && (
                                <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-zinc-400 bg-black/60 px-1.5 py-0.5 rounded">
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  <span>A gravar...</span>
                                </div>
                              )}

                              <div className="flex items-start justify-between gap-1.5">
                                <h4 className="text-xs font-semibold text-foreground line-clamp-2">
                                  {item.title}
                                </h4>
                                <span
                                  className={`text-[9px] font-medium px-1.5 py-0.2 rounded-md border capitalize shrink-0 ${getPriorityBadgeVariant(
                                    itemPriority
                                  )}`}
                                >
                                  {itemPriority}
                                </span>
                              </div>

                              {item.content && (
                                <p className="text-[11px] text-muted-foreground line-clamp-2">
                                  {item.content}
                                </p>
                              )}

                              <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px] text-muted-foreground">
                                <span>{dueDateFormatted || (meta.assignee_name as string) || "—"}</span>

                                {/* Quick Move Control */}
                                <div
                                  className="flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <label htmlFor={`move-${item.id}`} className="sr-only">
                                    Mover para coluna
                                  </label>
                                  <select
                                    id={`move-${item.id}`}
                                    value={col.id}
                                    disabled={isPending}
                                    onChange={(e) => handleMoveKanban(item, e.target.value)}
                                    className="bg-background border border-border text-[10px] rounded px-1.5 py-0.5 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
                                  >
                                    {kanbanColumns.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        Mover: {c.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : hasActiveFilters ? (
        /* Empty State for Filters */
        <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-border bg-card/40 text-center space-y-3">
          <Filter className="h-8 w-8 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Nenhum registo encontrado</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            Nenhum item corresponde aos critérios de pesquisa e filtros selecionados.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-colors"
          >
            Limpar Filtros
          </button>
        </div>
      ) : (
        /* General Empty State */
        <div className="flex flex-col items-center justify-center py-14 px-4 rounded-xl border border-dashed border-border bg-card/40 text-center space-y-3">
          <div className="p-3 rounded-2xl bg-secondary border border-border text-muted-foreground">
            <EntityIcon className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Sem {title.toLowerCase()} registados</h3>
          <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
            Começa a estruturar a inteligência organizacional da tua empresa adicionando novos registos.
          </p>
          {onOpenCreate && (
            <button
              type="button"
              onClick={onOpenCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 px-4 py-2 text-xs font-semibold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-opacity"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{createButtonText}</span>
            </button>
          )}
        </div>
      )}

      {/* Edit Entity Modal */}
      {editingEntity && (
        <EditEntityModal
          isOpen={Boolean(editingEntity)}
          onClose={() => setEditingEntity(null)}
          entity={editingEntity}
          onEntityUpdated={handleEntityUpdated}
          onEntityDeleted={handleEntityDeleted}
        />
      )}
    </div>
  );
}
