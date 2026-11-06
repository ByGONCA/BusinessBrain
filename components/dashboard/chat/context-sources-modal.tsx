"use client";

import * as React from "react";
import {
  X,
  Search,
  Database,
  FileText,
  CreditCard,
  Github,
  Brain,
  Check,
  Minus,
  Lock,
  ChevronDown,
  ChevronRight,
  Target,
  FolderGit2,
  CheckSquare,
  DollarSign,
  TrendingUp,
  Users,
  Receipt,
  GitPullRequest,
  GitCommit,
  Mail,
  Calendar,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { ContextSourceItem } from "@/lib/ai/auth/types";
import { getAvailableContextSourcesAction } from "@/lib/ai/auth/actions";

interface ContextSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSourceIds: string[];
  onApplySources: (newIds: string[]) => void;
}

const LOCALIZED_SYSTEM_SOURCES: Record<string, { label: string; desc?: string }> = {
  "area:pages": {
    label: "Pages & Documents",
    desc: "Operational manuals, internal documentation, and team notes.",
  },
  "area:emails": {
    label: "Emails & Communications",
    desc: "Query synced emails on demand via Gmail/Outlook.",
  },
  "area:calendar": {
    label: "Calendar & Meetings",
    desc: "Scheduled events, appointments, and organizational calendar.",
  },
  "area:brain": {
    label: "Decisions & Organizational Memory",
    desc: "Record of technical decisions, meeting minutes, and strategic agreements.",
  },
  "area:goals": {
    label: "Objectives & Strategic Goals",
    desc: "OKRs, targets, and strategic alignment.",
  },
  "area:projects": {
    label: "Projects & Initiatives",
    desc: "Corporate initiatives, teams, and milestone tracking.",
  },
  "area:tasks": {
    label: "Tasks & Deliverables",
    desc: "Operational tasks, deliverables, and action plans.",
  },
  "area:finance": {
    label: "Financial Metrics & Stripe",
    desc: "MRR, net revenue, customer retention, and Stripe subscriptions.",
  },
  "area:github": {
    label: "GitHub & Repository Code",
    desc: "Pull requests, engineering discussions, and commits.",
  },
  "finance:mrr": {
    label: "MRR & Run-Rate (ARR)",
    desc: "Monthly recurring revenue, annualized run-rate, and growth.",
  },
  "finance:subscriptions": {
    label: "Subscriptions & Churn",
    desc: "Active subscriber count, plans, and retention rates.",
  },
  "finance:revenue": {
    label: "Net Revenue & Gross Volume",
    desc: "Cleared period billing and Stripe financial history.",
  },
  "finance:customers": {
    label: "Customers & LTV Retention",
    desc: "Active customer contracts and retention metrics.",
  },
  "github:prs": {
    label: "Pull Requests & Code Reviews",
    desc: "Code reviews and merge approvals.",
  },
  "github:commits": {
    label: "Commits & Code History",
    desc: "Chronological record of commits across repository branches.",
  },
  "email:recent_inbox": {
    label: "Recent Received Emails",
    desc: "Latest communications and synced threads via Gmail/Outlook.",
  },
  "email:billing_threads": {
    label: "Financial Emails & Invoices",
    desc: "Billing communications, Stripe receipts, and vendor notices.",
  },
  "email:clients": {
    label: "Client Communications",
    desc: "Messages exchanged with enterprise clients and partners.",
  },
  "brain:decisions": {
    label: "Technical & Architectural Decisions",
    desc: "Formal records of technology choices, architecture, and engineering.",
  },
  "brain:meetings": {
    label: "Meeting Minutes & Alignments",
    desc: "History of strategic leadership alignments and notes.",
  },
};

export function ContextSourcesModal({
  isOpen,
  onClose,
  selectedSourceIds,
  onApplySources,
}: ContextSourcesModalProps) {
  const { locale } = useLanguage();
  const isPt = locale === "pt";

  const [sources, setSources] = React.useState<ContextSourceItem[]>([]);
  // Ensure 'area:pages' is never selected directly
  const [selected, setSelected] = React.useState<Set<string>>(
    new Set(selectedSourceIds.filter((id) => id !== "area:pages"))
  );
  const [search, setSearch] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
    new Set(["area:pages", "area:finance"])
  );

  React.useEffect(() => {
    if (isOpen) {
      setSelected(new Set(selectedSourceIds.filter((id) => id !== "area:pages")));
      setIsLoading(true);
      getAvailableContextSourcesAction().then((res) => {
        setIsLoading(false);
        if (res.success && res.sources) {
          setSources(res.sources);
        }
      });
    }
  }, [isOpen, selectedSourceIds]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getItemLabel = (item: ContextSourceItem): string => {
    if (isPt) return item.label;
    return LOCALIZED_SYSTEM_SOURCES[item.id]?.label || item.label;
  };

  const getItemDescription = (item: ContextSourceItem): string | undefined => {
    if (isPt) return item.description;
    return LOCALIZED_SYSTEM_SOURCES[item.id]?.desc || item.description;
  };

  // Flatten all selectable items (excludes category containers like 'area:pages')
  const getAllItemIds = (items: ContextSourceItem[]): string[] => {
    const ids: string[] = [];
    const traverse = (list: ContextSourceItem[]) => {
      for (const item of list) {
        if (item.id !== "area:pages") {
          ids.push(item.id);
        }
        if (item.children && item.children.length > 0) {
          traverse(item.children);
        }
      }
    };
    traverse(items);
    return ids;
  };

  // Collect all descendant IDs for a given source (excluding area:pages itself)
  const getDescendantIds = (item: ContextSourceItem): string[] => {
    const ids: string[] = [];
    const traverse = (list: ContextSourceItem[]) => {
      for (const child of list) {
        if (child.id !== "area:pages") {
          ids.push(child.id);
        }
        if (child.children && child.children.length > 0) {
          traverse(child.children);
        }
      }
    };
    if (item.children) {
      traverse(item.children);
    }
    return ids;
  };

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleItem = (item: ContextSourceItem) => {
    // INVARIANT: 'area:pages' can NEVER be selected directly as a blanket item.
    // Clicking it simply toggles expansion of its pages.
    if (item.id === "area:pages") {
      toggleExpand(item.id);
      return;
    }

    if (!item.hasAccess) return;

    setSelected((prev) => {
      const next = new Set(prev);
      const isCurrentlySelected = next.has(item.id);
      const descendants = getDescendantIds(item);

      if (isCurrentlySelected) {
        // Uncheck this item and all its descendants
        next.delete(item.id);
        for (const descId of descendants) {
          next.delete(descId);
        }
      } else {
        // Check this item and its descendants
        next.add(item.id);
        for (const descId of descendants) {
          next.add(descId);
        }
      }

      // Safety check: always strip 'area:pages'
      next.delete("area:pages");
      return next;
    });
  };

  // Toggle all pages inside area:pages
  const toggleAllPages = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pageArea = sources.find((s) => s.id === "area:pages");
    if (!pageArea || !pageArea.children) return;

    const childIds = getDescendantIds(pageArea);
    const allChecked = childIds.length > 0 && childIds.every((id) => selected.has(id));

    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        for (const id of childIds) next.delete(id);
      } else {
        for (const id of childIds) next.add(id);
      }
      next.delete("area:pages");
      return next;
    });
  };

  const selectAll = () => {
    const all = getAllItemIds(sources);
    setSelected(new Set(all.filter((id) => id !== "area:pages")));
  };

  const selectPagesOnly = () => {
    const pageArea = sources.find((s) => s.id === "area:pages");
    if (!pageArea) return;
    const pageIds = getDescendantIds(pageArea);
    setSelected(new Set(pageIds.filter((id) => id !== "area:pages")));
  };

  const selectFinanceOnly = () => {
    const financeArea = sources.find((s) => s.id === "area:finance");
    if (!financeArea) return;
    const financeIds = [financeArea.id, ...getDescendantIds(financeArea)];
    setSelected(new Set(financeIds));
  };

  const clearAll = () => {
    setSelected(new Set());
  };

  const handleSave = () => {
    const cleanIds = Array.from(selected).filter((id) => id !== "area:pages");
    onApplySources(cleanIds);
    onClose();
  };

  // Determine check state: "checked" | "indeterminate" | "unchecked"
  const getCheckState = (item: ContextSourceItem): "checked" | "indeterminate" | "unchecked" => {
    if (item.id === "area:pages") {
      const descendants = getDescendantIds(item);
      if (descendants.length === 0) return "unchecked";
      const checkedDescendants = descendants.filter((id) => selected.has(id));
      if (checkedDescendants.length === descendants.length) return "checked";
      if (checkedDescendants.length > 0) return "indeterminate";
      return "unchecked";
    }

    const isSelfChecked = selected.has(item.id);
    const descendants = getDescendantIds(item);

    if (descendants.length === 0) {
      return isSelfChecked ? "checked" : "unchecked";
    }

    const checkedDescendants = descendants.filter((id) => selected.has(id));

    if (isSelfChecked || checkedDescendants.length === descendants.length) {
      return "checked";
    }

    if (checkedDescendants.length > 0) {
      return "indeterminate";
    }

    return "unchecked";
  };

  // Filter sources & children according to search query
  const matchesSearch = (item: ContextSourceItem, term: string): boolean => {
    const label = getItemLabel(item).toLowerCase();
    const desc = getItemDescription(item)?.toLowerCase() || "";
    if (label.includes(term) || desc.includes(term)) return true;
    if (item.children && item.children.length > 0) {
      return item.children.some((c) => matchesSearch(c, term));
    }
    return false;
  };

  const filterTree = (list: ContextSourceItem[], term: string): ContextSourceItem[] => {
    if (!term) return list;
    return list
      .filter((item) => matchesSearch(item, term))
      .map((item) => {
        if (!item.children || item.children.length === 0) return item;
        return {
          ...item,
          children: filterTree(item.children, term),
        };
      });
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredSources = filterTree(sources, normalizedSearch);

  const getSourceIcon = (type: string, id: string, iconString?: string) => {
    if (iconString && iconString.trim() !== "" && iconString.length <= 4) {
      return <span className="text-sm shrink-0 leading-none">{iconString}</span>;
    }
    if (id === "area:pages") return <Folder className="h-4 w-4 text-muted-foreground" />;
    if (id === "finance:mrr") return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
    if (id === "finance:subscriptions") return <Users className="h-3.5 w-3.5 text-blue-400" />;
    if (id === "finance:revenue") return <DollarSign className="h-3.5 w-3.5 text-emerald-400" />;
    if (id === "finance:customers") return <Receipt className="h-3.5 w-3.5 text-amber-400" />;
    if (id.includes("finance")) return <CreditCard className="h-4 w-4 text-emerald-400" />;
    if (id === "github:prs") return <GitPullRequest className="h-3.5 w-3.5 text-purple-400" />;
    if (id === "github:commits") return <GitCommit className="h-3.5 w-3.5 text-purple-400" />;
    if (id.includes("github")) return <Github className="h-4 w-4 text-purple-400" />;
    if (id.includes("email") || type === "email") return <Mail className="h-3.5 w-3.5 text-sky-400" />;
    if (id.includes("calendar") || type === "calendar") return <Calendar className="h-3.5 w-3.5 text-amber-400" />;
    if (id.includes("brain") || type === "brain") return <Brain className="h-4 w-4 text-blue-400" />;
    if (id.includes("goal") || type === "goal") return <Target className="h-4 w-4 text-emerald-400" />;
    if (id.includes("project") || type === "project") return <FolderGit2 className="h-4 w-4 text-indigo-400" />;
    if (id.includes("task") || type === "task") return <CheckSquare className="h-4 w-4 text-blue-400" />;
    return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  // Recursive renderer for tree nodes
  const renderSourceItem = (item: ContextSourceItem, depth = 0) => {
    const isPagesCategory = item.id === "area:pages";
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedIds.has(item.id) || normalizedSearch.length > 0;
    const checkState = getCheckState(item);
    const isDisabled = !item.hasAccess;
    const label = getItemLabel(item);
    const description = getItemDescription(item);

    return (
      <div key={item.id} className="group/item">
        <div
          onClick={() => toggleItem(item)}
          className={`relative flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer border ${
            isPagesCategory
              ? "bg-card/70 hover:bg-surface-secondary border-white/[0.05]"
              : checkState !== "unchecked"
              ? "bg-surface-secondary hover:bg-white/[0.07] border-border"
              : "border-transparent hover:bg-surface-secondary hover:border-white/[0.04]"
          } ${isDisabled ? "opacity-40 cursor-not-allowed hover:bg-transparent" : ""}`}
          style={{ paddingLeft: `${Math.max(12, depth * 20 + 12)}px` }}
        >
          {/* Left section: Checkbox or Expand Indicator + Icon + Label & Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* If 'area:pages', render category folder toggle icon instead of a selectable check */}
            {isPagesCategory ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(item.id, e)}
                className="h-4 w-4 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                title={isExpanded ? (isPt ? "Recolher páginas" : "Collapse pages") : (isPt ? "Expandir páginas" : "Expand pages")}
              >
                {isExpanded ? (
                  <FolderOpen className="h-4 w-4 text-primary" />
                ) : (
                  <Folder className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            ) : (
              <div
                className={`h-4 w-4 rounded-md shrink-0 flex items-center justify-center border transition-all duration-150 ${
                  checkState === "checked"
                    ? "bg-primary border-primary text-primary-foreground shadow-xs"
                    : checkState === "indeterminate"
                    ? "bg-primary/20 border-primary text-primary"
                    : "border-white/[0.15] bg-surface-secondary/80 hover:border-white/[0.3]"
                }`}
              >
                {checkState === "checked" && <Check className="h-3 w-3 stroke-[3]" />}
                {checkState === "indeterminate" && <Minus className="h-3 w-3 stroke-[3]" />}
              </div>
            )}

            {/* Context Icon */}
            <div className="shrink-0 flex items-center justify-center">
              {getSourceIcon(item.type, item.id, item.icon)}
            </div>

            {/* Label and Subtitle */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium truncate ${
                    isPagesCategory
                      ? "text-foreground font-semibold"
                      : checkState !== "unchecked"
                      ? "text-foreground font-semibold"
                      : "text-foreground/90"
                  }`}
                >
                  {label}
                </span>

                {item.requiresExplicitGrant && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-md shrink-0">
                    <Lock className="h-2.5 w-2.5" />
                    {isPt ? "Restrito" : "Restricted"}
                  </span>
                )}
              </div>

              {description && (
                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Right section: Count / Lock / Expander */}
          <div className="flex items-center gap-2 shrink-0">
            {isDisabled && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3 text-zinc-500" />
                {isPt ? "Sem acesso" : "No access"}
              </span>
            )}

            {/* Quick toggle for all pages inside area:pages */}
            {isPagesCategory && hasChildren && (
              <button
                type="button"
                onClick={toggleAllPages}
                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md border border-border hover:border-border-strong bg-surface-secondary/50 hover:bg-white/[0.05] transition-colors"
                title={isPt ? "Marcar ou desmarcar todas as páginas" : "Select or deselect all pages"}
              >
                {checkState === "checked"
                  ? isPt ? "Desmarcar todas" : "Deselect all"
                  : isPt ? "Selecionar todas" : "Select all"}
              </button>
            )}

            {hasChildren && (
              <button
                type="button"
                onClick={(e) => toggleExpand(item.id, e)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-surface-secondary transition-colors"
                title={isExpanded ? (isPt ? "Recolher subníveis" : "Collapse sub-items") : (isPt ? "Expandir subníveis" : "Expand sub-items")}
              >
                <span className="font-mono text-[10px] text-muted-foreground/80">
                  {item.itemCount || item.children?.length}
                </span>
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 transition-transform" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 transition-transform" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Nested Sub-items (Tree View) */}
        {hasChildren && isExpanded && (
          <div className="relative mt-0.5 space-y-0.5 before:absolute before:left-[21px] before:top-1 before:bottom-2 before:w-px before:bg-white/[0.06]">
            {item.children!.map((child) => renderSourceItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-left cursor-default"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-surface-secondary border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-surface-secondary text-foreground flex items-center justify-center border border-border">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground tracking-tight">
                {isPt ? "Fontes de Contexto da IA" : "AI Context Sources"}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {isPt
                  ? "Selecione as páginas e fontes específicas que a IA pode consultar nesta sessão."
                  : "Select specific pages and sources AI is authorized to reference in this session."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter Bar & Quick Selectors */}
        <div className="px-5 py-3 border-b border-border bg-card/30 space-y-2.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isPt
                  ? "Pesquisar páginas, áreas ou subcategorias..."
                  : "Search pages, areas, or subcategories..."
              }
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-border bg-surface-secondary focus:outline-none focus:ring-1 focus:ring-white/[0.2] focus:border-border-strong text-foreground placeholder:text-muted-foreground/80 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="font-medium text-foreground">
                {selected.size}{" "}
                {isPt
                  ? selected.size === 1
                    ? "fonte selecionada"
                    : "fontes selecionadas"
                  : selected.size === 1
                  ? "source selected"
                  : "sources selected"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                {isPt ? "Todas" : "All"}
              </button>
              <span className="text-white/[0.1]">•</span>
              <button
                type="button"
                onClick={selectPagesOnly}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                {isPt ? "Apenas Páginas" : "Pages Only"}
              </button>
              <span className="text-white/[0.1]">•</span>
              <button
                type="button"
                onClick={selectFinanceOnly}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                {isPt ? "Financeiro" : "Finance"}
              </button>
              <span className="text-white/[0.1]">•</span>
              <button
                type="button"
                onClick={clearAll}
                className="hover:text-rose-400 transition-colors cursor-pointer"
              >
                {isPt ? "Limpar" : "Clear"}
              </button>
            </div>
          </div>
        </div>

        {/* Source List Tree Container */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>{isPt ? "A carregar árvore de fontes do workspace..." : "Loading workspace source tree..."}</span>
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-1">
              <p>{isPt ? "Nenhuma fonte ou documento corresponde à pesquisa." : "No sources or pages match your search."}</p>
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-primary hover:underline text-[11px]"
              >
                {isPt ? "Limpar filtro de pesquisa" : "Clear search filter"}
              </button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredSources.map((item) => renderSourceItem(item, 0))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-border flex items-center justify-between bg-surface-secondary border-b border-border">
          <p className="text-[11px] text-muted-foreground max-w-[55%] leading-tight">
            {isPt
              ? "A IA recupera conhecimento exclusivamente das páginas e fontes marcadas."
              : "AI retrieves knowledge strictly from active selected pages and sources."}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-hover transition-colors text-foreground cursor-pointer"
            >
              {isPt ? "Cancelar" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-surface-secondary hover:bg-hover text-zinc-200 hover:text-white border border-white/[0.1] hover:border-white/[0.18] transition-colors shadow-xs cursor-pointer"
            >
              {isPt ? "Aplicar Fontes" : "Apply Sources"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
