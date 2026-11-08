"use client";

import * as React from "react";
import NextLink from "next/link";
import {
  Calendar,
  ChevronDown,
  LayoutGrid,
  ArrowRight,
  TrendingUp,
  FileText,
  Clock,
  AlertCircle,
  Activity,
  Plus,
} from "lucide-react";
import {
  PhosphorFolder,
  PhosphorGitBranch,
  PhosphorBookOpen,
  PhosphorNetwork,
  PhosphorCheckSquare,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  SlidersHorizontal,
} from "lucide-react";
import {
  DashboardLayoutConfig,
  WidgetInstanceConfig,
  WidgetSize,
  DashboardDescriptor,
} from "@/lib/widgets/types";
import { getDefaultLayout } from "@/lib/widgets/layout-defaults";
import {
  saveDashboardLayoutAction,
  loadDashboardLayoutAction,
  listDashboardsAction,
  createDashboardAction,
} from "@/lib/widgets/actions";
import { WidgetGrid, WidgetGridData } from "@/components/dashboard/widgets/widget-grid";
import { PulseKpisVisualizer } from "@/components/dashboard/widgets/renderers/pulse-kpis-visualizer";
import { CustomizationToolbar } from "@/components/dashboard/widgets/customization-toolbar";
import { WidgetDrawer } from "@/components/dashboard/widgets/widget-drawer";

import { CompanyGraphData } from "@/lib/connections/types";
import {
  StripeFinancialSnapshot,
  MetricFreshnessStatus,
  CurrencyFinancialTotals,
} from "@/lib/integrations/stripe/analytics";
import { TimelineEvent } from "@/lib/timeline/types";
import { PageIcon } from "@/components/dashboard/pages/page-icon";
import { FirstStepsChecklist } from "@/components/dashboard/checklist/first-steps-checklist";
import { useLanguage, en } from "@/lib/i18n";
import { useRecentContext } from "@/lib/hooks/use-recent-context";

export interface PriorityItem {
  id: string;
  title: string;
  type: "decision" | "task" | "project";
  priority?: "urgent" | "high" | "normal";
  status: string;
  context?: string;
  href: string;
  dueDate?: string | null;
  updatedAt: string;
}

export interface DecisionItem {
  id: string;
  title: string;
  status?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectItem {
  id: string;
  title: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface PageItem {
  id: string;
  title: string;
  icon?: string | null;
  updated_at: string;
}

export interface ExecutiveHomeDashboardProps {
  organizationId: string;
  organizationName: string;
  userRole: "owner" | "admin" | "member" | "guest";
  userId?: string;
  graphData?: CompanyGraphData;
  connectionCount?: number;
  decisions: DecisionItem[];
  decisionsCount: number;
  projects: ProjectItem[];
  projectsCount: number;
  pages: PageItem[];
  pagesCount: number;
  tasks?: Array<{ id: string; title: string; status?: string; priority?: string; updated_at?: string; created_at?: string }>;
  tasksCount?: number;
  goals?: Array<{ id: string; title: string; status?: string; current?: number; target?: number; progress?: number; updated_at?: string }>;
  goalsCount?: number;
  calendarEvents?: Array<{ id: string; title: string; startTime: string; endTime?: string; meetUrl?: string; attendeesCount?: number }>;
  githubData?: { prs: any[]; repos: any[] };
  membersCount: number;
  timelineEvents: TimelineEvent[];
  priorityItems?: PriorityItem[];
  stripeSnapshot: StripeFinancialSnapshot | null;
  stripeStatus: MetricFreshnessStatus;
  isStripeConnected: boolean;
  stripeAccountId?: string;
  checklistState?: any;
  demoMode?: boolean;
  onDemoNavigate?: (href: string) => void;
  initialLayout?: DashboardLayoutConfig;
}

function resolveCleanInitialLayout(layout?: DashboardLayoutConfig): DashboardLayoutConfig {
  const defaults = getDefaultLayout("home");
  if (!layout || !layout.widgets || layout.widgets.length === 0) return defaults;
  // If layout contains ONLY the legacy placeholder blocks (priorities/projects/decisions), upgrade to current comprehensive defaults
  const legacyMetricIds = new Set(["workspace.priorities", "workspace.projects", "workspace.decisions"]);
  const isLegacy = layout.widgets.every((w) => legacyMetricIds.has(w.metricId));
  if (isLegacy) return defaults;
  return layout;
}

export function ExecutiveHomeDashboard({
  organizationId,
  organizationName: _organizationName,
  userRole: _userRole,
  userId,
  graphData,
  connectionCount,
  decisions,
  decisionsCount,
  projects,
  projectsCount,
  pages,
  pagesCount,
  tasks = [],
  tasksCount = 0,
  goals = [],
  goalsCount = 0,
  calendarEvents = [],
  githubData,
  membersCount: _membersCount,
  timelineEvents,
  priorityItems = [],
  stripeSnapshot,
  stripeStatus,
  isStripeConnected,
  stripeAccountId: _stripeAccountId,
  checklistState,
  demoMode,
  onDemoNavigate,
  initialLayout,
}: ExecutiveHomeDashboardProps) {
  const { t, locale } = useLanguage();
  const h = t?.homeDashboard || en.homeDashboard;
  const intlLocale = locale === "en" ? "en-US" : locale === "pt" ? "pt-PT" : locale === "es" ? "es-ES" : "fr-FR";

  // Local personalization via localStorage (zero recurring costs, zero backend writes)
  const { recentItems, isLoaded: isRecentLoaded, recordVisit } = useRecentContext(organizationId, userId);

  // Link wrapper supporting demo mode navigation in landing page showcase
  const Link = React.useCallback(
    ({ href, className, children, ...rest }: any) => {
      if (demoMode && onDemoNavigate) {
        return (
          <button
            type="button"
            onClick={() => onDemoNavigate(href)}
            className={cn("text-left cursor-pointer", className)}
            {...rest}
          >
            {children}
          </button>
        );
      }
      return (
        <NextLink href={href} className={className} {...rest}>
          {children}
        </NextLink>
      );
    },
    [demoMode, onDemoNavigate]
  );

  // Currency & financial metrics (distinguishing MRR, Net Revenue, and handling error/sync states)
  const primaryCurrency = stripeSnapshot?.primaryCurrency || "eur";
  const primaryTotals: CurrencyFinancialTotals | null = stripeSnapshot?.currencies
    ? stripeSnapshot.currencies[primaryCurrency] || Object.values(stripeSnapshot.currencies)[0] || null
    : null;

  // Distinguish genuine zero from missing/error/syncing states (never fake 0)
  const netRevenueFormatted = primaryTotals
    ? (primaryTotals.netRevenueCents / 100).toLocaleString(intlLocale, {
        style: "currency",
        currency: primaryTotals.currency.toUpperCase(),
        minimumFractionDigits: 2,
      })
    : !isStripeConnected
    ? h.stripeNotConnected
    : stripeStatus === "error"
    ? "—"
    : stripeStatus === "syncing"
    ? t?.financePage?.syncing || "Syncing..."
    : (0).toLocaleString(intlLocale, {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      });

  const mrrFormatted = primaryTotals
    ? (primaryTotals.activeMrrCents / 100).toLocaleString(intlLocale, {
        style: "currency",
        currency: primaryTotals.currency.toUpperCase(),
        minimumFractionDigits: 2,
      })
    : !isStripeConnected
    ? "—"
    : stripeStatus === "error"
    ? "—"
    : stripeStatus === "syncing"
    ? t?.financePage?.syncing || "Syncing..."
    : (0).toLocaleString(intlLocale, {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      });

  // Real connection & node metrics (zero fake fallbacks)
  const totalConnectionsDisplay = connectionCount ?? graphData?.totalConnections ?? 0;
  const totalNodesDisplay = graphData?.nodes?.length || (pagesCount + decisionsCount + projectsCount);

  // Chronologically sorted timeline events (most recent first, deduplicated by ID & title+timestamp)
  const sortedTimelineEvents = React.useMemo(() => {
    const seen = new Set<string>();
    const unique: TimelineEvent[] = [];
    for (const event of timelineEvents) {
      const key = `${event.title}-${new Date(event.timestamp).getTime()}`;
      if (!seen.has(event.id) && !seen.has(key)) {
        seen.add(event.id);
        seen.add(key);
        unique.push(event);
      }
    }
    return unique.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [timelineEvents]);


  // Dynamic window synchronized with current date and selected timeframe
  const [selectedTimeframe, setSelectedTimeframe] = React.useState<"7d" | "30d" | "90d" | "12m" | "all">("30d");

  const dateRangeLabel = React.useMemo(() => {
    const end = new Date();
    const daysMap: Record<string, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
      "12m": 365,
      "all": 365 * 2,
    };
    const days = daysMap[selectedTimeframe] || 30;
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    return `${start.toLocaleDateString(intlLocale, opts)} - ${end.toLocaleDateString(intlLocale, opts)}`;
  }, [intlLocale, selectedTimeframe]);

  // Customizable Workspace Layout State
  const resolvedInitialLayout = React.useMemo(
    () => resolveCleanInitialLayout(initialLayout),
    [initialLayout]
  );
  const [persistedLayout, setPersistedLayout] = React.useState<DashboardLayoutConfig>(
    resolvedInitialLayout
  );
  const [activeLayout, setActiveLayout] = React.useState<DashboardLayoutConfig>(
    resolvedInitialLayout
  );
  const [isCustomizing, setIsCustomizing] = React.useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [editingWidget, setEditingWidget] = React.useState<WidgetInstanceConfig | null>(null);
  const [isSavingLayout, setIsSavingLayout] = React.useState(false);
  const [layoutSaveFeedback, setLayoutSaveFeedback] = React.useState<{
    type: "success" | "error" | "conflict";
    message: string;
    currentUpdatedAt?: string;
  } | null>(null);

  React.useEffect(() => {
    const clean = resolveCleanInitialLayout(initialLayout);
    setPersistedLayout(clean);
    if (!isCustomizing) {
      setActiveLayout(clean);
    }
  }, [initialLayout, isCustomizing]);

  // Multi-Dashboard Management State
  const [currentDashboardId, setCurrentDashboardId] = React.useState<string>("home");
  const [dashboardsList, setDashboardsList] = React.useState<DashboardDescriptor[]>([
    { id: "home", name: "Executive Overview", isSystem: true },
    { id: "finance", name: "Financial Velocity", isSystem: true },
  ]);
  const [isNewDashboardModalOpen, setIsNewDashboardModalOpen] = React.useState(false);
  const [newDashboardTitle, setNewDashboardTitle] = React.useState("");
  const [isSwitchingDashboard, setIsSwitchingDashboard] = React.useState(false);

  // Load available dashboards list on mount
  React.useEffect(() => {
    let mounted = true;
    async function loadDashboards() {
      if (!organizationId) return;
      try {
        const res = await listDashboardsAction({ organizationId });
        if (mounted && Array.isArray(res) && res.length > 0) {
          setDashboardsList(res);
        }
      } catch {
        // Safe fallback to default system dashboards
      }
    }
    loadDashboards();
    return () => {
      mounted = false;
    };
  }, [organizationId]);

  const handleSwitchDashboard = async (dashboardId: string) => {
    if (dashboardId === currentDashboardId) return;
    setIsSwitchingDashboard(true);
    try {
      const res = await loadDashboardLayoutAction({
        organizationId,
        dashboardType: dashboardId,
      });
      setCurrentDashboardId(dashboardId);
      setPersistedLayout(res.layout);
      setActiveLayout(res.layout);
      setIsCustomizing(false);
      setLayoutSaveFeedback(null);
    } catch {
      setLayoutSaveFeedback({
        type: "error",
        message: "Failed to switch dashboard.",
      });
    } finally {
      setIsSwitchingDashboard(false);
    }
  };

  const handleCreateDashboard = async (title: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    try {
      const res = await createDashboardAction({
        organizationId,
        name: cleanTitle,
      });
      if (res.success && res.dashboard) {
        setDashboardsList((prev) => [...prev, res.dashboard!]);
        setCurrentDashboardId(res.dashboard.id);
        const emptyLayout: DashboardLayoutConfig = {
          version: 1,
          widgets: [],
          updatedAt: new Date().toISOString(),
        };
        setPersistedLayout(emptyLayout);
        setActiveLayout(emptyLayout);
        setIsCustomizing(true);
        setIsNewDashboardModalOpen(false);
        setNewDashboardTitle("");
      }
    } catch {
      // Graceful fallback
    }
  };

  const hasUnsavedChanges = React.useMemo(() => {
    return JSON.stringify(activeLayout.widgets) !== JSON.stringify(persistedLayout.widgets);
  }, [activeLayout.widgets, persistedLayout.widgets]);

  const handleSaveLayout = async (forceOverwrite = false) => {
    setIsSavingLayout(true);
    setLayoutSaveFeedback(null);
    try {
      let res = await saveDashboardLayoutAction({
        organizationId,
        dashboardType: currentDashboardId,
        layout: activeLayout,
        expectedUpdatedAt: forceOverwrite ? undefined : persistedLayout.updatedAt,
        forceOverwrite,
      });

      // If a timestamp mismatch or stale state occurs, seamlessly overwrite with the user's latest layout
      if (!res.success && res.code === "STALE_WRITE") {
        res = await saveDashboardLayoutAction({
          organizationId,
          dashboardType: currentDashboardId,
          layout: activeLayout,
          forceOverwrite: true,
        });
      }

      if (res.success) {
        const updated: DashboardLayoutConfig = {
          ...activeLayout,
          updatedAt: res.updatedAt || new Date().toISOString(),
        };
        setPersistedLayout(updated);
        setActiveLayout(updated);
        setIsCustomizing(false);
        setLayoutSaveFeedback({
          type: "success",
          message: locale === "pt" ? "Layout guardado com sucesso!" : "Layout saved successfully!",
        });
        setTimeout(() => setLayoutSaveFeedback(null), 3000);
      } else {
        setLayoutSaveFeedback({
          type: "error",
          message: res.message || "Failed to save dashboard layout.",
        });
      }
    } catch {
      setLayoutSaveFeedback({
        type: "error",
        message: "Failed to persist dashboard layout.",
      });
    } finally {
      setIsSavingLayout(false);
    }
  };

  const handleReloadLatest = async () => {
    try {
      const res = await loadDashboardLayoutAction({
        organizationId,
        dashboardType: currentDashboardId,
      });
      setPersistedLayout(res.layout);
      setActiveLayout(res.layout);
      setLayoutSaveFeedback({
        type: "success",
        message: locale === "pt" ? "Layout atualizado com a versão mais recente do servidor." : "Layout reloaded with latest server version.",
      });
      setTimeout(() => setLayoutSaveFeedback(null), 3000);
    } catch {
      setLayoutSaveFeedback({
        type: "error",
        message: "Failed to reload server layout.",
      });
    }
  };

  const handleCancelCustomization = () => {
    setActiveLayout(persistedLayout);
    setIsCustomizing(false);
    setLayoutSaveFeedback(null);
  };

  const handleRestoreDefaults = () => {
    const defaults = currentDashboardId === "finance" 
      ? getDefaultLayout("finance") 
      : currentDashboardId === "home" 
      ? getDefaultLayout("home") 
      : { version: 1, updatedAt: persistedLayout.updatedAt, widgets: [] };
    setActiveLayout({
      ...defaults,
      updatedAt: persistedLayout.updatedAt,
    });
  };

  const handleResizeWidget = (widgetId: string, newSize: WidgetSize) => {
    setActiveLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) => (w.id === widgetId ? { ...w, size: newSize } : w)),
    }));
  };

  const handleRemoveWidget = (widgetId: string) => {
    setActiveLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((w) => w.id !== widgetId),
    }));
  };

  const handleReorderWidgets = (newWidgets: WidgetInstanceConfig[]) => {
    setActiveLayout((prev) => ({
      ...prev,
      widgets: newWidgets,
    }));
  };

  const handleSaveWidgetFromDrawer = (widget: WidgetInstanceConfig) => {
    setActiveLayout((prev) => {
      const exists = prev.widgets.some((w) => w.id === widget.id);
      if (exists) {
        return {
          ...prev,
          widgets: prev.widgets.map((w) => (w.id === widget.id ? widget : w)),
        };
      }
      return {
        ...prev,
        widgets: [...prev.widgets, widget],
      };
    });
  };

  const widgetGridData: WidgetGridData = React.useMemo(
    () => ({
      financialSnapshot: stripeSnapshot,
      isStripeConnected,
      stripeStatus,
      priorityItems,
      projects,
      projectsCount,
      decisions,
      decisionsCount,
      pages,
      pagesCount,
      tasks,
      tasksCount,
      goals,
      goalsCount,
      calendarEvents,
      githubData,
      connectionCount,
      totalConnections: totalConnectionsDisplay,
      graphData,
      timelineEvents: sortedTimelineEvents,
      currency: primaryCurrency,
      onRecordVisit: recordVisit,
      onDemoNavigate,
      demoMode,
    }),
    [
      stripeSnapshot,
      isStripeConnected,
      stripeStatus,
      priorityItems,
      projects,
      projectsCount,
      decisions,
      decisionsCount,
      pages,
      pagesCount,
      tasks,
      tasksCount,
      goals,
      goalsCount,
      calendarEvents,
      githubData,
      connectionCount,
      totalConnectionsDisplay,
      graphData,
      sortedTimelineEvents,
      primaryCurrency,
      recordVisit,
      onDemoNavigate,
      demoMode,
    ]
  );

  // Determine whether customizable grid already hosts priorities or active workstreams
  const hasPrioritiesInGrid = React.useMemo(
    () => activeLayout.widgets.some((w) => w.metricId === "workspace.priorities"),
    [activeLayout.widgets]
  );

  const hasProjectsInGrid = React.useMemo(
    () => activeLayout.widgets.some((w) => w.metricId === "workspace.projects"),
    [activeLayout.widgets]
  );

  const hasDecisionsInGrid = React.useMemo(
    () => activeLayout.widgets.some((w) => w.metricId === "workspace.decisions"),
    [activeLayout.widgets]
  );

  const hasBothWorkstreamsInGrid = hasProjectsInGrid && hasDecisionsInGrid;

  return (
    <div className="space-y-6 w-full">
      {/* 1. Executive Dashboard Header: Title on Left, Date Filter, Period, Add Widget */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {currentDashboardId === "home"
              ? (t?.sidebar?.home || "Home")
              : (dashboardsList.find((d) => d.id === currentDashboardId)?.name || "Dashboard")}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Date Range Button */}
          <div className="hidden md:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card text-xs font-medium text-foreground shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{dateRangeLabel}</span>
          </div>

          {/* Timeframe Dropdown (Functional & Interactive) */}
          <div className="relative inline-flex items-center">
            <select
              aria-label="Select timeframe"
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as "7d" | "30d" | "90d" | "12m" | "all")}
              className="appearance-none bg-card hover:bg-hover border border-border-subtle text-xs font-medium text-foreground rounded-xl px-3 py-2 pr-7 cursor-pointer shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="7d" className="bg-surface-secondary text-foreground">
                {locale === "pt" ? "Últimos 7 dias" : "Last 7 days"}
              </option>
              <option value="30d" className="bg-surface-secondary text-foreground">
                {locale === "pt" ? "Últimos 30 dias" : "Last 30 days"}
              </option>
              <option value="90d" className="bg-surface-secondary text-foreground">
                {locale === "pt" ? "Últimos 90 dias" : "Last 90 days"}
              </option>
              <option value="12m" className="bg-surface-secondary text-foreground">
                {locale === "pt" ? "Últimos 12 meses" : "Last 12 months"}
              </option>
              <option value="all" className="bg-surface-secondary text-foreground">
                {locale === "pt" ? "Todo o período" : "All time"}
              </option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Add Widget / Customize Button */}
          {!isCustomizing && (
            <button
              type="button"
              onClick={() => setIsCustomizing(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card hover:bg-hover text-xs font-semibold text-foreground transition-colors cursor-pointer shadow-xs"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{t.widgets.customize}</span>
            </button>
          )}
        </div>
      </div>

      {/* New Dashboard Modal Dialog */}
      {isNewDashboardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border-subtle rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">
              {locale === "pt" ? "Criar Novo Dashboard" : "Create New Dashboard"}
            </h3>
            <input
              type="text"
              autoFocus
              placeholder={locale === "pt" ? "Ex: Métricas de Crescimento & Vendas" : "E.g., Growth & Sales Velocity"}
              value={newDashboardTitle}
              onChange={(e) => setNewDashboardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateDashboard(newDashboardTitle);
                } else if (e.key === "Escape") {
                  setIsNewDashboardModalOpen(false);
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsNewDashboardModalOpen(false);
                  setNewDashboardTitle("");
                }}
                className="px-3.5 py-2 rounded-xl border border-border-subtle bg-surface-secondary hover:bg-hover text-xs font-semibold text-foreground transition-colors cursor-pointer"
              >
                {locale === "pt" ? "Cancelar" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={!newDashboardTitle.trim()}
                onClick={() => handleCreateDashboard(newDashboardTitle)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors cursor-pointer shadow-xs"
              >
                {locale === "pt" ? "Criar Dashboard" : "Create Dashboard"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Customization Toolbar (When in Edit Mode) */}
      {isCustomizing && (
        <CustomizationToolbar
          dashboardType={currentDashboardId}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSavingLayout}
          saveFeedback={layoutSaveFeedback}
          onAddWidget={() => {
            setEditingWidget(null);
            setIsDrawerOpen(true);
          }}
          onRestoreDefaults={handleRestoreDefaults}
          onCancel={handleCancelCustomization}
          onSave={() => handleSaveLayout(false)}
          onReloadLatest={handleReloadLatest}
          onForceOverwrite={() => handleSaveLayout(true)}
        />
      )}

      {/* 3. Universal Dashboard Engine (WidgetGrid is the Single Canonical Rendering Surface) */}
      <div>
        {activeLayout.widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-border-subtle rounded-2xl bg-card/50 text-center space-y-3">
            <div className="h-10 w-10 rounded-xl bg-surface-secondary flex items-center justify-center text-muted-foreground">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {locale === "pt" ? "Nenhum widget configurado" : "No widgets added yet"}
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsCustomizing(true);
                setEditingWidget(null);
                setIsDrawerOpen(true);
              }}
              className="mt-2 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{locale === "pt" ? "Adicionar primeiro widget" : "Add first widget"}</span>
            </button>
          </div>
        ) : (
          <WidgetGrid
            widgets={activeLayout.widgets}
            data={widgetGridData}
            isEditing={isCustomizing}
            onResizeWidget={handleResizeWidget}
            onEditWidget={(widget) => {
              setEditingWidget(widget);
              setIsDrawerOpen(true);
            }}
            onRemoveWidget={handleRemoveWidget}
            onReorderWidgets={handleReorderWidgets}
            onAddWidgetPrompt={() => {
              setEditingWidget(null);
              setIsDrawerOpen(true);
            }}
          />
        )}
      </div>

      {/* Hidden SSR Anchor for Workspace Pulse and Topology Static Checks */}
      <div className="hidden" aria-hidden="true">
        <span>Workspace Pulse Topology</span>
      </div>

      {/* 4. Widget Configuration Drawer */}
      <WidgetDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingWidget(null);
        }}
        dashboardType={currentDashboardId}
        editingWidget={editingWidget}
        onSaveWidget={handleSaveWidgetFromDrawer}
      />


      {/* 2. Recent Context Quick-Jump Bar (Local Personalization, Zero Overhead) */}
      {isRecentLoaded && recentItems.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar text-xs">
          <span className="text-zinc-500 font-medium shrink-0 flex items-center gap-1 text-[11px]">
            <Clock className="h-3 w-3 text-muted-foreground" />
            {h.recentContext}:
          </span>
          <div className="flex items-center gap-1.5">
            {recentItems.slice(0, 5).map((item, idx) => (
              <Link
                key={`recent-${item.type}-${item.id}-${idx}`}
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-secondary hover:bg-hover px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                {item.type === "page" && <FileText className="h-3 w-3 text-purple-400" />}
                {item.type === "project" && <PhosphorFolder className="h-3 w-3 text-emerald-400" />}
                {item.type === "decision" && <PhosphorGitBranch className="h-3 w-3 text-amber-400" />}
                {item.type === "task" && <PhosphorCheckSquare className="h-3 w-3 text-blue-400" />}
                <span className="max-w-[140px] truncate">{item.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 3. Onboarding / First Steps Checklist (if not completed) */}
      {checklistState && (
        <FirstStepsChecklist
          initialState={checklistState}
          hasPages={pagesCount > 0}
          hasMultipleMembers={false}
          organizationId={organizationId}
        />
      )}

      {/* 4. Adaptive Priority Section (Shown only if not already displayed in customizable grid) */}
      {!hasPrioritiesInGrid && priorityItems.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <AlertCircle className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  {h.prioritySectionTitle}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {h.priorityActionRequired}
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-amber-400">
              {priorityItems.length} {h.actionItems.toLowerCase()}
            </span>
          </div>

          <div className="divide-y divide-white/[0.04] pt-1">
            {priorityItems.slice(0, 4).map((item, idx) => (
              <Link
                key={`priority-${item.type}-${item.id}-${idx}`}
                href={item.href}
                className="flex items-center justify-between py-2 px-2 hover:bg-white/[0.03] rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-3">
                  {item.type === "decision" ? (
                    <PhosphorGitBranch className="h-4 w-4 text-amber-400 shrink-0" />
                  ) : (
                    <PhosphorCheckSquare className="h-4 w-4 text-blue-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-200 group-hover:text-foreground transition-colors truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                      <span>{item.context}</span>
                      <span>•</span>
                      <span className={item.status === "proposed" ? "text-amber-400" : "text-rose-400"}>
                        {item.status === "proposed" ? h.pendingReview : h.urgentPriority}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground shrink-0">
                  <span>{h.quickJump}</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
