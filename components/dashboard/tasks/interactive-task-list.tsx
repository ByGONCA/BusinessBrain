"use client";

import * as React from "react";
import {
  CheckSquare,
  Square,
  Trash2,
  Clock,
  Loader2,
  Search,
  Filter,
  User,
  Calendar,
  X,
  Edit2,
} from "lucide-react";
import { toggleTaskStatusAction, deleteCompanyEntityAction } from "@/lib/entities/actions";
import { CompanyEntity } from "@/lib/entities/types";
import { EditEntityModal } from "@/components/dashboard/entities/edit-entity-modal";
import { FilterDropdownButton, FilterOption } from "@/components/dashboard/entities/filter-dropdown-button";

interface TaskItem {
  id: string;
  title: string;
  content?: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function InteractiveTaskList({ initialTasks }: { initialTasks: TaskItem[] }) {
  const [tasks, setTasks] = React.useState(initialTasks);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<"date_desc" | "date_asc" | "title_asc" | "due_soon" | "priority_desc">("due_soon");
  const [editingTask, setEditingTask] = React.useState<CompanyEntity | null>(null);

  React.useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const handleToggle = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLoadingId(taskId);

    // Optimistic toggle
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const currentMeta = t.metadata || {};
          const isDone = currentMeta.status === "completed" || currentMeta.completed === true;
          return {
            ...t,
            metadata: {
              ...currentMeta,
              status: isDone ? "in_progress" : "completed",
              completed: !isDone,
            },
          };
        }
        return t;
      })
    );

    const result = await toggleTaskStatusAction(taskId);
    setLoadingId(null);
    if (!result.success) {
      setTasks(initialTasks);
    }
  };

  const handleDelete = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLoadingId(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    const result = await deleteCompanyEntityAction(taskId);
    setLoadingId(null);
    if (!result.success) {
      setTasks(initialTasks);
    }
  };

  const priorityWeight: Record<string, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  // Filtered & sorted tasks
  const filteredAndSorted = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return tasks
      .filter((t) => {
        const meta = t.metadata || {};
        const isCompleted = meta.status === "completed" || meta.completed === true;

        // Search text
        if (q) {
          const matchTitle = (t.title || "").toLowerCase().includes(q);
          const matchContent = (t.content || "").toLowerCase().includes(q);
          const matchNotes = ((meta.notes as string) || "").toLowerCase().includes(q);
          const matchAssignee = ((meta.assignee_name as string) || "").toLowerCase().includes(q);
          if (!matchTitle && !matchContent && !matchNotes && !matchAssignee) {
            return false;
          }
        }

        // Status filter
        if (statusFilter === "completed" && !isCompleted) return false;
        if (statusFilter === "in_progress" && (isCompleted || meta.status !== "in_progress")) return false;
        if (statusFilter === "todo" && (isCompleted || (meta.status && meta.status !== "todo"))) return false;

        // Priority filter
        if (priorityFilter !== "all") {
          const p = (meta.priority as string) || "medium";
          if (p !== priorityFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aMeta = a.metadata || {};
        const bMeta = b.metadata || {};

        if (sortBy === "due_soon") {
          const aDate = (aMeta.due_date as string) || (aMeta.target_date as string) || "9999";
          const bDate = (bMeta.due_date as string) || (bMeta.target_date as string) || "9999";
          return aDate.localeCompare(bDate);
        }
        if (sortBy === "priority_desc") {
          const aP = priorityWeight[(aMeta.priority as string) || "medium"] || 0;
          const bP = priorityWeight[(bMeta.priority as string) || "medium"] || 0;
          return bP - aP;
        }
        if (sortBy === "title_asc") {
          return (a.title || "").localeCompare(b.title || "");
        }
        if (sortBy === "date_asc") {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [tasks, searchQuery, statusFilter, priorityFilter, sortBy]);

  const hasActiveFilters = searchQuery !== "" || statusFilter !== "all" || priorityFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setSortBy("due_soon");
  };

  const openEditModal = (task: TaskItem) => {
    setEditingTask({
      id: task.id,
      organization_id: "",
      type: "task",
      title: task.title,
      content: task.content || "",
      metadata: task.metadata || {},
      created_by: null,
      created_at: task.created_at,
      updated_at: task.updated_at,
    });
  };

  return (
    <div className="space-y-3">
      {/* Search & Filter Toolbar */}
      <div className="p-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-card/40">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar tarefas..."
            className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-zinc-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <FilterDropdownButton
            label="Estado"
            value={statusFilter}
            options={[
              { value: "all", label: "Todos os estados" },
              { value: "todo", label: "A Fazer" },
              { value: "in_progress", label: "Em Progresso" },
              { value: "completed", label: "Concluídas" },
            ]}
            onChange={setStatusFilter}
            icon={Filter}
            defaultValue="all"
          />

          {/* Priority Filter */}
          <FilterDropdownButton
            label="Prioridade"
            value={priorityFilter}
            options={[
              { value: "all", label: "Todas as prioridades" },
              { value: "urgent", label: "Urgente" },
              { value: "high", label: "Alta" },
              { value: "medium", label: "Média" },
              { value: "low", label: "Baixa" },
            ]}
            onChange={setPriorityFilter}
            defaultValue="all"
          />

          {/* Sort Filter */}
          <FilterDropdownButton
            label="Ordenar"
            value={sortBy}
            options={[
              { value: "due_soon", label: "Prazo Mais Próximo" },
              { value: "priority_desc", label: "Prioridade Alta" },
              { value: "date_desc", label: "Mais Recentes" },
              { value: "title_asc", label: "Título (A-Z)" },
            ]}
            onChange={(val) => setSortBy(val as any)}
            defaultValue="due_soon"
          />

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Task Rows */}
      {filteredAndSorted.length > 0 ? (
        <div className="divide-y divide-border">
          {filteredAndSorted.map((task) => {
            const isCompleted =
              task.metadata?.status === "completed" || task.metadata?.completed === true;
            const priority = (task.metadata?.priority as string) || "medium";
            const rawDue = (task.metadata?.due_date as string) || (task.metadata?.target_date as string);
            const dueDate = rawDue ? rawDue.split("T")[0] : null;
            const assignee = (task.metadata?.assignee_name as string) || null;
            const isLoading = loadingId === task.id;

            return (
              <div
                key={task.id}
                onClick={() => openEditModal(task)}
                className="p-3.5 flex items-center justify-between gap-3 hover:bg-hover transition-colors text-xs group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => handleToggle(task.id, e)}
                    disabled={isLoading}
                    className="text-muted-foreground hover:text-emerald-400 transition-colors shrink-0 p-0.5 focus:outline-hidden"
                    aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                    ) : isCompleted ? (
                      <CheckSquare className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Square className="h-4 w-4 text-zinc-500 hover:text-zinc-300" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <span
                      className={`font-medium truncate block ${
                        isCompleted ? "line-through text-muted-foreground" : "text-foreground group-hover:text-indigo-400 transition-colors"
                      }`}
                    >
                      {task.title}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      {dueDate && (
                        <span className="flex items-center gap-1 text-zinc-400">
                          <Clock className="h-3 w-3" />
                          <span>{dueDate}</span>
                        </span>
                      )}
                      {assignee && (
                        <span className="flex items-center gap-1 text-zinc-400">
                          <User className="h-3 w-3" />
                          <span>{assignee}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {/* Priority badge (clean rounded-md, no pill bubble) */}
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-medium capitalize border ${
                      priority === "urgent"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : priority === "high"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : priority === "low"
                        ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    }`}
                  >
                    {priority}
                  </span>

                  {/* Status indicator (inline dot + text, no pill bubble) */}
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isCompleted
                          ? "bg-emerald-400"
                          : task.metadata?.status === "in_progress"
                          ? "bg-blue-400"
                          : "bg-zinc-500"
                      }`}
                    />
                    <span className="capitalize">
                      {isCompleted ? "Done" : (task.metadata?.status as string) || "Pending"}
                    </span>
                  </span>

                  {/* Delete button on hover */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(task.id, e)}
                    disabled={isLoading}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 rounded-md hover:bg-white/[0.04] transition-all"
                    title="Delete task"
                    aria-label="Delete task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : hasActiveFilters ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          Nenhuma tarefa corresponde aos filtros selecionados.
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-muted-foreground">
          Nenhuma tarefa registada nesta organização.
        </div>
      )}

      {/* Edit Modal */}
      {editingTask && (
        <EditEntityModal
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          entity={editingTask}
          onEntityUpdated={(updated) => {
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
          }}
          onEntityDeleted={(id) => {
            setTasks((prev) => prev.filter((t) => t.id !== id));
          }}
        />
      )}
    </div>
  );
}
