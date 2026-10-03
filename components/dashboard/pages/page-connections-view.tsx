"use client";

import * as React from "react";
import {
  PageConnectionRecord,
  EntityType,
} from "@/lib/pages/types";
import {
  CheckSquare,
  Scale,
  FolderGit2,
  Calendar,
  Target,
  FileText,
  User,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  Link2,
} from "lucide-react";
import { PageIcon } from "./page-icon";
import { cn } from "@/lib/utils";

interface PageConnectionsViewProps {
  pageTitle: string;
  pageIcon: string;
  connections: PageConnectionRecord[];
  onOpenConnectModal: () => void;
  onRemoveConnection: (connectionId: string) => void;
  onNavigateToBlock?: (blockId: string) => void;
}

const ENTITY_GROUP_CONFIG: Record<
  EntityType,
  { label: string; singular: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  decision: { label: "Decisions", singular: "Decision", icon: Scale, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  task: { label: "Tasks", singular: "Task", icon: CheckSquare, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  project: { label: "Projects", singular: "Project", icon: FolderGit2, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" },
  meeting: { label: "Meetings", singular: "Meeting", icon: Calendar, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
  goal: { label: "Goals", singular: "Goal", icon: Target, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  document: { label: "Documents", singular: "Document", icon: FileText, color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" },
  person: { label: "People", singular: "Person", icon: User, color: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
  page: { label: "Pages", singular: "Page", icon: FileText, color: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20" },
};

export function PageConnectionsView({
  pageTitle,
  pageIcon,
  connections,
  onOpenConnectModal,
  onRemoveConnection,
  onNavigateToBlock,
}: PageConnectionsViewProps) {
  // Group connections by target_type
  const groupedConnections = React.useMemo(() => {
    const groups: Partial<Record<EntityType, PageConnectionRecord[]>> = {};
    for (const conn of connections) {
      if (!groups[conn.target_type]) {
        groups[conn.target_type] = [];
      }
      groups[conn.target_type]!.push(conn);
    }
    return groups;
  }, [connections]);

  const groupKeys = Object.keys(groupedConnections) as EntityType[];

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <PageIcon
            icon={pageIcon}
            className="text-4xl sm:text-5xl select-none"
            imgClassName="h-12 w-12 sm:h-14 sm:w-14 rounded-xl object-cover"
          />
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {pageTitle || "Untitled"}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
              <Link2 className="h-3.5 w-3.5 text-indigo-500" />
              <span>Company Brain Ledger ({connections.length} connections)</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenConnectModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-medium transition-colors shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Connect Entity</span>
        </button>
      </div>

      {/* Content */}
      <div className="mt-8 space-y-8">
        {connections.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8">
            <Sparkles className="h-8 w-8 text-indigo-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              No entity connections yet
            </p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
              Connect this page or individual sentences and blocks to Decisions, Tasks, Projects, Meetings, or Goals.
            </p>
            <button
              type="button"
              onClick={onOpenConnectModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:bg-indigo-100 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Connect to Company Brain
            </button>
          </div>
        ) : (
          groupKeys.map((type) => {
            const cfg = ENTITY_GROUP_CONFIG[type] || ENTITY_GROUP_CONFIG.document;
            const Icon = cfg.icon;
            const items = groupedConnections[type] || [];

            return (
              <div key={type} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={cn("p-1 rounded border text-xs", cfg.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    {cfg.label} ({items.length})
                  </h3>
                </div>

                <div className="grid gap-2">
                  {items.map((conn) => (
                    <div
                      key={conn.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0 font-medium text-xs">
                          →
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {conn.target_title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                            <span>
                              Linked to {conn.source_type === "page" ? "Page" : "Block"}
                            </span>
                            {conn.source_type === "block" && onNavigateToBlock && (
                              <button
                                type="button"
                                onClick={() => onNavigateToBlock(conn.source_id)}
                                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                              >
                                View block <ExternalLink className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Remove connection to "${conn.target_title}"?`)) {
                              onRemoveConnection(conn.id);
                            }
                          }}
                          className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all"
                          title="Remove connection"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
