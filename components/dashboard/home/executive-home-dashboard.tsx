"use client";

import * as React from "react";
import NextLink from "next/link";
import {
  ArrowRight,
  TrendingUp,
  FileText,
  Clock,
  AlertCircle,
  Activity,
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
} from "@/lib/widgets/types";
import { getDefaultLayout } from "@/lib/widgets/layout-defaults";
import {
  saveDashboardLayoutAction,
  loadDashboardLayoutAction,
} from "@/lib/widgets/actions";
import { WidgetGrid, WidgetGridData } from "@/components/dashboard/widgets/widget-grid";
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

  const hasUnsavedChanges = React.useMemo(() => {
    return JSON.stringify(activeLayout.widgets) !== JSON.stringify(persistedLayout.widgets);
  }, [activeLayout.widgets, persistedLayout.widgets]);

  const handleSaveLayout = async (forceOverwrite = false) => {
    setIsSavingLayout(true);
    setLayoutSaveFeedback(null);
    try {
      let res = await saveDashboardLayoutAction({
        organizationId,
        dashboardType: "home",
        layout: activeLayout,
        expectedUpdatedAt: forceOverwrite ? undefined : persistedLayout.updatedAt,
        forceOverwrite,
      });

      // If a timestamp mismatch or stale state occurs, seamlessly overwrite with the user's latest layout
      if (!res.success && res.code === "STALE_WRITE") {
        res = await saveDashboardLayoutAction({
          organizationId,
          dashboardType: "home",
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
        dashboardType: "home",
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
    const defaults = getDefaultLayout("home");
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
    <div className="space-y-5 max-w-6xl">
      {/* 1. Clean Title with Customize Action */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {t?.sidebar?.home || "Home"}
        </h1>

        {!isCustomizing && (
          <button
            type="button"
            onClick={() => setIsCustomizing(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.08] bg-[#121316] hover:bg-[#1A1D23] text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer shadow-xs"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
            <span>{t.widgets.customize}</span>
          </button>
        )}
      </div>

      {/* 2. Customization Toolbar (When in Edit Mode) */}
      {isCustomizing && (
        <CustomizationToolbar
          dashboardType="home"
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

      {/* 3. Customizable Widget Grid */}
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

      {/* 4. Widget Configuration Drawer */}
      <WidgetDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingWidget(null);
        }}
        dashboardType="home"
        editingWidget={editingWidget}
        onSaveWidget={handleSaveWidgetFromDrawer}
      />


      {/* 2. Recent Context Quick-Jump Bar (Local Personalization, Zero Overhead) */}
      {isRecentLoaded && recentItems.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar text-xs">
          <span className="text-zinc-500 font-medium shrink-0 flex items-center gap-1 text-[11px]">
            <Clock className="h-3 w-3 text-zinc-400" />
            {h.recentContext}:
          </span>
          <div className="flex items-center gap-1.5">
            {recentItems.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-[#121316] hover:bg-[#1A1D23] hover:border-white/15 px-2.5 py-1 text-xs text-zinc-300 hover:text-white transition-colors shrink-0"
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
        <div className="rounded-xl border border-amber-500/25 bg-[#121316] p-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <AlertCircle className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
                  {h.prioritySectionTitle}
                </h2>
                <p className="text-[11px] text-zinc-400">
                  {h.priorityActionRequired}
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-amber-400">
              {priorityItems.length} {h.actionItems.toLowerCase()}
            </span>
          </div>

          <div className="divide-y divide-white/[0.04] pt-1">
            {priorityItems.slice(0, 4).map((item) => (
              <Link
                key={item.id}
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
                    <p className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors truncate">
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
                <div className="flex items-center gap-1 text-xs text-zinc-400 group-hover:text-white shrink-0">
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
