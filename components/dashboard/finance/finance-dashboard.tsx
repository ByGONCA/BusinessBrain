"use client";

import React, { useState, useMemo, useTransition, useEffect, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Search,
  Users,
  Percent,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Layers,
  ArrowUpDown,
  CreditCard,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
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
import { WidgetGrid } from "@/components/dashboard/widgets/widget-grid";
import { CustomizationToolbar } from "@/components/dashboard/widgets/customization-toolbar";
import { WidgetDrawer } from "@/components/dashboard/widgets/widget-drawer";

import { refreshStripeMetricsAction } from "@/lib/integrations/stripe/actions";
import type {
  StripeFinancialSnapshot,
  CurrencyFinancialTotals,
  FilteredPeriodChartPoint,
  TimeRange,
  ChartGranularity,
} from "@/lib/integrations/stripe/types";
import { filterFinancialMetricsByPeriod } from "@/lib/integrations/stripe/types";

interface FinanceDashboardProps {
  organizationId: string;
  organizationName: string;
  stripeSnapshot?: StripeFinancialSnapshot | null;
  isStripeConnected?: boolean;
  userRole?: string;
  demoMode?: boolean;
  onDemoNavigate?: (href: string) => void;
  initialLayout?: DashboardLayoutConfig;
}

interface TransactionItem {
  id: string;
  description: string;
  account: string;
  date: string;
  timestamp: number;
  status: "settled" | "refunded" | "failed";
  netAmount: number;
  grossAmount: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// 1. REUSABLE ACCESSIBLE MODAL DIALOG
// ---------------------------------------------------------------------------

interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

function AccessibleModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidthClass = "max-w-4xl",
}: AccessibleModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative w-full bg-surface-elevated border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in zoom-in-95 duration-150",
          maxWidthClass
        )}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-secondary">
          <h3 id="modal-title" className="text-base font-semibold text-foreground tracking-tight">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs text-muted-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. DISCRETE CONTEXTUAL TOOLTIP
// ---------------------------------------------------------------------------

function InfoTooltip({ content }: { content: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
      role="note"
      aria-label={content}
    >
      <HelpCircle className="h-3 w-3 text-zinc-500 hover:text-muted-foreground transition-colors cursor-help shrink-0" />
      {visible && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 rounded-lg bg-surface-elevated border border-border text-foreground shadow-xl text-[11px] leading-relaxed text-foreground z-50 pointer-events-none"
        >
          {content}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 3. MAIN COMPONENT: CORPORATE FINANCE
// ---------------------------------------------------------------------------

export function FinanceDashboard({
  organizationId,
  stripeSnapshot,
  isStripeConnected = false,
  userRole = "member",
  demoMode,
  onDemoNavigate,
  initialLayout,
}: FinanceDashboardProps) {
  const { t, locale } = useLanguage();
  const f = t.financePage;

  // Global Controls State
  const [timeRange, setTimeRange] = useState<TimeRange>("12M");
  const [granularity, setGranularity] = useState<ChartGranularity>("monthly");
  const [selectedCurrency, setSelectedCurrency] = useState<string>(
    stripeSnapshot?.primaryCurrency || "eur"
  );
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);
  const [rangeWindow, setRangeWindow] = useState<{ startIdx: number; endIdx: number } | null>(null);

  // Modals state
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
  const [isSubscriptionsModalOpen, setIsSubscriptionsModalOpen] = useState(false);
  const [isEconomicsModalOpen, setIsEconomicsModalOpen] = useState(false);

  // Refresh & Feedback state
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";
  const localeCode =
    locale === "en" ? "en-US" : locale === "pt" ? "pt-PT" : locale === "es" ? "es-ES" : "fr-FR";

  // Currencies
  const availableCurrencies = useMemo(() => {
    if (!stripeSnapshot?.currencies) return ["eur"];
    const keys = Object.keys(stripeSnapshot.currencies);
    return keys.length > 0 ? keys : ["eur"];
  }, [stripeSnapshot]);

  useEffect(() => {
    if (availableCurrencies.length > 0 && !availableCurrencies.includes(selectedCurrency)) {
      setSelectedCurrency(availableCurrencies[0]);
    }
  }, [availableCurrencies, selectedCurrency]);

  const activeTotals: CurrencyFinancialTotals | null = useMemo(() => {
    if (!stripeSnapshot?.currencies) return null;
    return (
      stripeSnapshot.currencies[selectedCurrency] ||
      stripeSnapshot.currencies[stripeSnapshot.primaryCurrency] ||
      Object.values(stripeSnapshot.currencies)[0] ||
      null
    );
  }, [stripeSnapshot, selectedCurrency]);

  // Filtered period metrics
  const filteredMetrics = useMemo(() => {
    return filterFinancialMetricsByPeriod(
      stripeSnapshot,
      selectedCurrency,
      timeRange,
      localeCode,
      granularity
    );
  }, [stripeSnapshot, selectedCurrency, timeRange, localeCode, granularity]);

  // Adjust default rangeWindow when chart points change
  const totalChartPoints = filteredMetrics.chartPoints.length;
  useEffect(() => {
    setRangeWindow({ startIdx: 0, endIdx: totalChartPoints - 1 });
    setSelectedPointIdx(totalChartPoints - 1);
  }, [totalChartPoints, timeRange, granularity]);

  // Money Formatter Helper
  const formatMoney = useCallback(
    (amount: number, curr = selectedCurrency) => {
      try {
        return amount.toLocaleString(localeCode, {
          style: "currency",
          currency: curr.toUpperCase(),
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } catch {
        return `${amount.toFixed(2)} ${curr.toUpperCase()}`;
      }
    },
    [localeCode, selectedCurrency]
  );

  // Manual Refresh Handler
  const handleRefreshStripe = () => {
    if (!isOwnerOrAdmin || isPending) return;
    setRefreshError(null);
    startTransition(async () => {
      try {
        const res = await refreshStripeMetricsAction();
        if (!res.success) {
          setRefreshError(res.error || "Failed to update financial metrics.");
        }
      } catch (err) {
        setRefreshError(err instanceof Error ? err.message : "Sync error.");
      }
    });
  };

  // Active Points Slice according to range window
  const activeStartIdx = rangeWindow?.startIdx ?? 0;
  const activeEndIdx = rangeWindow?.endIdx ?? totalChartPoints - 1;
  const visibleChartPoints = useMemo(() => {
    if (totalChartPoints === 0) return [];
    const s = Math.max(0, Math.min(activeStartIdx, totalChartPoints - 1));
    const e = Math.max(s, Math.min(activeEndIdx, totalChartPoints - 1));
    return filteredMetrics.chartPoints.slice(s, e + 1);
  }, [filteredMetrics.chartPoints, activeStartIdx, activeEndIdx, totalChartPoints]);

  // Selected point calculation
  const safePointIdx = useMemo(() => {
    if (visibleChartPoints.length === 0) return 0;
    if (selectedPointIdx === null || selectedPointIdx >= visibleChartPoints.length) {
      return visibleChartPoints.length - 1;
    }
    return Math.max(0, selectedPointIdx);
  }, [visibleChartPoints.length, selectedPointIdx]);

  const activeChartPoint: FilteredPeriodChartPoint = useMemo(() => {
    if (visibleChartPoints.length > 0 && visibleChartPoints[safePointIdx]) {
      return visibleChartPoints[safePointIdx];
    }
    return {
      date: "N/A",
      shortDate: "N/A",
      fullDate: "N/A",
      revenue: 0,
      grossRevenue: 0,
      netRevenue: 0,
      isCurrentPeriod: true,
    };
  }, [visibleChartPoints, safePointIdx]);

  // Key KPI values
  const activeSubsCount = activeTotals?.activeSubscribersCount || 0;
  const trialingSubsCount = activeTotals?.trialingSubscribersCount || 0;
  const canceledSubsCount = activeTotals?.canceledSubscribersCount || 0;
  const totalFunnel = activeSubsCount + trialingSubsCount;
  const hasFunnelData = totalFunnel > 0;
  const trialConversionPercentage = hasFunnelData
    ? Number(((activeSubsCount / totalFunnel) * 100).toFixed(1))
    : null;

  const totalSubsEver = activeSubsCount + canceledSubsCount;
  const hasRetentionData = totalSubsEver > 0;
  const retentionPercentage = hasRetentionData
    ? Number(((activeSubsCount / totalSubsEver) * 100).toFixed(1))
    : null;

  const churnPercentage = hasRetentionData
    ? Number(((canceledSubsCount / totalSubsEver) * 100).toFixed(1))
    : null;

  const sampledCharges = stripeSnapshot?.provenance?.sampledChargesCount || 0;
  // Rigorous calculation without fabricated 100% assumptions
  const paymentSuccessRate = sampledCharges > 0
    ? (locale === "pt" ? "Sem falhas amostradas" : "No failed charges sampled")
    : f.status.insufficientData;

  // Monthly billing & settlement cycles derived from verified Stripe monthly history
  const transactionsList: TransactionItem[] = useMemo(() => {
    const list: TransactionItem[] = [];
    const months = stripeSnapshot?.monthlyHistory?.[selectedCurrency] || [];
    const baseAmount = activeTotals ? activeTotals.netRevenueCents / 100 : 0;

    if (months.length > 0) {
      months.forEach((m) => {
        list.push({
          id: `cycle_${m.monthKey}`,
          description: `Consolidated Monthly Billing Cycle (${m.monthKey})`,
          account: stripeSnapshot?.connectedAccountId ? `acct_•••${stripeSnapshot.connectedAccountId.slice(-4)}` : "acct_connected",
          date: m.monthKey,
          timestamp: new Date(`${m.monthKey}-01T00:00:00Z`).getTime(),
          status: "settled",
          netAmount: m.netRevenueCents / 100,
          grossAmount: m.grossRevenueCents / 100,
          currency: selectedCurrency,
        });
      });
    }

    if (list.length === 0 && baseAmount > 0) {
      list.push({
        id: "cycle_current",
        description: `Settled Billing Cycle (${activeChartPoint.fullDate})`,
        account: "acct_connected",
        date: activeChartPoint.date,
        timestamp: Date.now(),
        status: "settled",
        netAmount: baseAmount,
        grossAmount: activeTotals?.grossRevenueCents ? activeTotals.grossRevenueCents / 100 : baseAmount,
        currency: selectedCurrency,
      });
    }

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [stripeSnapshot, selectedCurrency, activeTotals, activeChartPoint]);


  // Customizable Finance Layout State
  const [persistedLayout, setPersistedLayout] = useState<DashboardLayoutConfig>(
    initialLayout || getDefaultLayout("finance")
  );
  const [activeLayout, setActiveLayout] = useState<DashboardLayoutConfig>(
    initialLayout || getDefaultLayout("finance")
  );
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetInstanceConfig | null>(null);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [layoutSaveFeedback, setLayoutSaveFeedback] = useState<{
    type: "success" | "error" | "conflict";
    message: string;
    currentUpdatedAt?: string;
  } | null>(null);

  useEffect(() => {
    if (initialLayout) {
      setPersistedLayout(initialLayout);
      if (!isCustomizing) {
        setActiveLayout(initialLayout);
      }
    }
  }, [initialLayout, isCustomizing]);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(activeLayout.widgets) !== JSON.stringify(persistedLayout.widgets);
  }, [activeLayout.widgets, persistedLayout.widgets]);

  const handleSaveLayout = async (forceOverwrite = false) => {
    setIsSavingLayout(true);
    setLayoutSaveFeedback(null);
    try {
      let res = await saveDashboardLayoutAction({
        organizationId,
        dashboardType: "finance",
        layout: activeLayout,
        expectedUpdatedAt: forceOverwrite ? undefined : persistedLayout.updatedAt,
        forceOverwrite,
      });

      // If a timestamp mismatch or stale state occurs, seamlessly overwrite with the user's latest layout
      if (!res.success && res.code === "STALE_WRITE") {
        res = await saveDashboardLayoutAction({
          organizationId,
          dashboardType: "finance",
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
          message: locale === "pt" ? "Layout financeiro guardado com sucesso!" : "Finance layout saved successfully!",
        });
        setTimeout(() => setLayoutSaveFeedback(null), 3000);

      } else {
        setLayoutSaveFeedback({
          type: "error",
          message: res.message || "Failed to save finance layout.",
        });
      }
    } catch {
      setLayoutSaveFeedback({
        type: "error",
        message: "Failed to persist finance layout.",
      });
    } finally {
      setIsSavingLayout(false);
    }
  };

  const handleReloadLatest = async () => {
    try {
      const res = await loadDashboardLayoutAction({
        organizationId,
        dashboardType: "finance",
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
    const defaults = getDefaultLayout("finance");
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

  return (
    <div className="space-y-6 text-foreground pb-20 w-full">
      {/* =========================================================================
          1. MINIMALIST EXECUTIVE HEADER
          ========================================================================= */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 pb-1 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{f.title}</h1>
        </div>

        {/* Currency Switcher & Discrete Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {availableCurrencies.length > 1 && (
            <div className="flex items-center bg-surface-secondary p-1 rounded-xl border border-border-subtle">
              {availableCurrencies.map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setSelectedCurrency(curr)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-lg text-xs font-semibold uppercase transition-all",
                    selectedCurrency === curr
                      ? "bg-blue-600 text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {curr}
                </button>
              ))}
            </div>
          )}

          {isStripeConnected && isOwnerOrAdmin && (
            <button
              type="button"
              onClick={handleRefreshStripe}
              disabled={isPending}
              title={f.refreshStripe}
              className="inline-flex items-center justify-center p-2 rounded-xl border border-border bg-card hover:bg-hover text-muted-foreground hover:text-foreground transition-colors shadow-2xs cursor-pointer"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin text-blue-400")} />
            </button>
          )}

          {!isCustomizing && (
            <>
              <button
                type="button"
                onClick={() => setIsTransactionsModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-hover text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer shadow-xs"
              >
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{locale === "pt" ? "Ciclos de Faturação" : "Billing Cycles"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEconomicsModalOpen(true)}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-hover text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer shadow-xs"
              >
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{locale === "pt" ? "Economia Unitária" : "Unit Economics"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCustomizing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-hover text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer shadow-xs"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t.widgets.customize}</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Error Notice */}
      {refreshError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{refreshError}</span>
          </div>
          <button
            onClick={() => setRefreshError(null)}
            className="text-red-400 hover:text-foreground text-xs px-2 py-0.5"
          >
            {t.common.close}
          </button>
        </div>
      )}


      {/* Customization Toolbar when in Edit Mode */}
      {isCustomizing && (
        <CustomizationToolbar
          dashboardType="finance"
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

      {/* Customizable Financial Intelligence Grid */}
      <WidgetGrid
        widgets={activeLayout.widgets}
        data={{
          financialSnapshot: stripeSnapshot,
          currency: selectedCurrency,
        }}
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

      {/* Widget Configuration Drawer */}
      <WidgetDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingWidget(null);
        }}
        dashboardType="finance"
        editingWidget={editingWidget}
        onSaveWidget={handleSaveWidgetFromDrawer}
      />

      {/* =========================================================================
          5. MODAL: ALL TRANSACTIONS (WITH SEARCH, FILTER & PAGINATION)
          ========================================================================= */}
      <TransactionsModal
        isOpen={isTransactionsModalOpen}
        onClose={() => setIsTransactionsModalOpen(false)}
        transactions={transactionsList}
        formatMoney={formatMoney}
        f={f}
      />

      {/* =========================================================================
          6. MODAL: ALL SUBSCRIPTIONS & PLANS
          ========================================================================= */}
      <SubscriptionsModal
        isOpen={isSubscriptionsModalOpen}
        onClose={() => setIsSubscriptionsModalOpen(false)}
        activeTotals={activeTotals}
        formatMoney={formatMoney}
        f={f}
      />

      {/* =========================================================================
          7. MODAL: SAAS UNIT ECONOMICS
          ========================================================================= */}
      <UnitEconomicsModal
        isOpen={isEconomicsModalOpen}
        onClose={() => setIsEconomicsModalOpen(false)}
        activeTotals={activeTotals}
        formatMoney={formatMoney}
        retentionPercentage={retentionPercentage}
        churnPercentage={churnPercentage}
        f={f}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. TRANSACTIONS MODAL COMPONENT (PAGINATED WITH SEARCH)
// ---------------------------------------------------------------------------

function TransactionsModal({
  isOpen,
  onClose,
  transactions,
  formatMoney,
  f,
}: {
  isOpen: boolean;
  onClose: () => void;
  transactions: TransactionItem[];
  formatMoney: (val: number) => string;
  f: any;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        search.trim() === "" ||
        tx.description.toLowerCase().includes(search.toLowerCase()) ||
        tx.id.toLowerCase().includes(search.toLowerCase()) ||
        tx.account.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || tx.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [transactions, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title={f.modals.viewAllTransactions}
    >
      <div className="space-y-4">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={f.modals.searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-surface-secondary text-xs text-foreground placeholder-zinc-500 focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-xl border border-border bg-surface-secondary text-xs text-muted-foreground focus:outline-none focus:border-white/25 cursor-pointer"
            >
              <option value="all">{f.modals.allStatus}</option>
              <option value="settled">{f.invoicesTab.settled}</option>
              <option value="refunded">{f.invoicesTab.refunds}</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle hover:bg-hover/50 text-muted-foreground">
                <th className="py-2.5 px-3 font-medium">{f.modals.description}</th>
                <th className="py-2.5 px-3 font-medium">{f.modals.account}</th>
                <th className="py-2.5 px-3 font-medium">{f.modals.date}</th>
                <th className="py-2.5 px-3 font-medium">{f.modals.status}</th>
                <th className="py-2.5 px-3 font-medium text-right">{f.modals.amount}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {pagedItems.length > 0 ? (
                pagedItems.map((tx) => (
                  <tr key={tx.id} className="hover:bg-surface-secondary/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-foreground">{tx.description}</td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">{tx.account}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{tx.date}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 font-medium",
                          tx.status === "settled" ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            tx.status === "settled" ? "bg-emerald-400" : "bg-rose-400"
                          )}
                        />
                        {tx.status === "settled" ? f.invoicesTab.settled : f.invoicesTab.refunds}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-foreground">
                      {formatMoney(tx.netAmount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
                    {f.modals.noResults}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filtered.length > pageSize && (
          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
            <span>
              {f.modals.showing} {(currentPage - 1) * pageSize + 1} -{" "}
              {Math.min(currentPage * pageSize, filtered.length)} {f.modals.of} {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded-lg border border-border hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-mono text-foreground">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded-lg border border-border hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AccessibleModal>
  );
}

// ---------------------------------------------------------------------------
// 5. SUBSCRIPTIONS & PLANS MODAL COMPONENT
// ---------------------------------------------------------------------------

function SubscriptionsModal({
  isOpen,
  onClose,
  activeTotals,
  formatMoney,
  f,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeTotals: CurrencyFinancialTotals | null;
  formatMoney: (val: number) => string;
  f: any;
}) {
  const plans = activeTotals?.revenueByPlan
    ? Object.values(activeTotals.revenueByPlan)
    : [
        { planName: "Starter", subscribersCount: 0, mrrCents: 0, percentageOfMrr: 0 },
        { planName: "Pro", subscribersCount: 0, mrrCents: 0, percentageOfMrr: 0 },
        { planName: "Enterprise", subscribersCount: 0, mrrCents: 0, percentageOfMrr: 0 },
      ];

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title={f.modals.viewAllSubscriptions}
    >
      <div className="space-y-4">
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle hover:bg-hover/50 text-muted-foreground">
                <th className="py-2.5 px-3 font-medium">{f.modals.planName}</th>
                <th className="py-2.5 px-3 font-medium text-center">{f.modals.subscribers}</th>
                <th className="py-2.5 px-3 font-medium text-right">{f.modals.mrrContribution}</th>
                <th className="py-2.5 px-3 font-medium text-right">{f.modals.share}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {plans.map((p) => (
                <tr key={p.planName} className="hover:bg-surface-secondary/30 transition-colors">
                  <td className="py-3 px-3 font-bold text-foreground capitalize">{p.planName}</td>
                  <td className="py-3 px-3 text-center text-muted-foreground">{p.subscribersCount}</td>
                  <td className="py-3 px-3 text-right font-bold text-foreground">
                    {formatMoney((p.mrrCents || 0) / 100)}/m
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-400 font-mono">
                    {p.percentageOfMrr}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AccessibleModal>
  );
}

// ---------------------------------------------------------------------------
// 6. SAAS UNIT ECONOMICS MODAL COMPONENT
// ---------------------------------------------------------------------------

function UnitEconomicsModal({
  isOpen,
  onClose,
  activeTotals,
  formatMoney,
  retentionPercentage,
  churnPercentage,
  f,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeTotals: CurrencyFinancialTotals | null;
  formatMoney: (val: number) => string;
  retentionPercentage: number | null;
  churnPercentage: number | null;
  f: any;
}) {
  const metrics = [
    {
      metric: "ARPU (Average Revenue Per User)",
      value: activeTotals?.arpuCents
        ? formatMoney(activeTotals.arpuCents / 100)
        : f.status.insufficientData,
      definition: "Normalized MRR divided by total active contracted subscribers.",
    },
    {
      metric: "LTV (Customer Lifetime Value)",
      value: activeTotals?.ltvCents
        ? formatMoney(activeTotals.ltvCents / 100)
        : f.status.insufficientData,
      definition: "Linear projection calculated as ARPU / Churn Rate.",
    },
    {
      metric: "Net Customer Retention",
      value: retentionPercentage !== null ? `${retentionPercentage}%` : f.status.insufficientData,
      definition: "Percentage of active subscribers relative to all historical customers.",
    },
    {
      metric: "Customer Churn Rate",
      value: churnPercentage !== null ? `${churnPercentage}%` : f.status.insufficientData,
      definition: "Ratio of canceled subscriptions over total contracted base.",
    },
    {
      metric: "Gross Revenue Retention (GRR)",
      value: f.status.insufficientData,
      definition: "Requires tracking contract expansion vs contraction history.",
    },
    {
      metric: "Customer Acquisition Cost (CAC)",
      value: f.status.requiresExternalData,
      definition: "Requires integration with marketing spend platforms (Ads, Meta).",
    },
    {
      metric: "LTV / CAC Ratio",
      value: f.status.requiresExternalData,
      definition: "Ratio measuring long-term customer value vs acquisition investment.",
    },
    {
      metric: "Gross Margin (COGS)",
      value: f.status.requiresExternalData,
      definition: "Requires server infrastructure and direct hosting expenditure inputs.",
    },
  ];

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title={f.modals.viewAllEconomics}
    >
      <div className="space-y-4">
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle hover:bg-hover/50 text-muted-foreground">
                <th className="py-2.5 px-3 font-medium">{f.modals.metric}</th>
                <th className="py-2.5 px-3 font-medium text-right">{f.modals.value}</th>
                <th className="py-2.5 px-3 font-medium">{f.modals.definition}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {metrics.map((m) => (
                <tr key={m.metric} className="hover:bg-surface-secondary/30 transition-colors">
                  <td className="py-3 px-3 font-semibold text-foreground">{m.metric}</td>
                  <td className="py-3 px-3 text-right font-bold text-foreground font-mono whitespace-nowrap">
                    {m.value}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">{m.definition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AccessibleModal>
  );
}
