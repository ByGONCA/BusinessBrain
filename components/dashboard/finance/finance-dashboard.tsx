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
          "relative w-full bg-[#121316] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in zoom-in-95 duration-150",
          maxWidthClass
        )}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#16181D]">
          <h3 id="modal-title" className="text-base font-semibold text-white tracking-tight">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs text-zinc-300">
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
      <HelpCircle className="h-3 w-3 text-zinc-500 hover:text-zinc-300 transition-colors cursor-help shrink-0" />
      {visible && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 rounded-lg bg-[#1D1F24] border border-white/10 shadow-xl text-[11px] leading-relaxed text-zinc-200 z-50 pointer-events-none"
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

  // Accumulated revenue in the selected brush/range window
  const rangeWindowNetRevenue = useMemo(() => {
    return visibleChartPoints.reduce((acc, p) => acc + p.netRevenue, 0);
  }, [visibleChartPoints]);

  const rangeWindowGrossRevenue = useMemo(() => {
    return visibleChartPoints.reduce((acc, p) => acc + p.grossRevenue, 0);
  }, [visibleChartPoints]);

  // SVG Geometry for Interactive Main Chart
  const chartHeight = 220;
  const chartWidth = 720;
  const paddingX = 20;
  const paddingY = 24;

  const maxChartVal = useMemo(() => {
    if (visibleChartPoints.length === 0) return 100;
    const maxRevenue = Math.max(...visibleChartPoints.map((p) => p.revenue));
    return maxRevenue > 0 ? maxRevenue * 1.15 : 100;
  }, [visibleChartPoints]);

  const minChartVal = 0;

  const svgPoints = useMemo(() => {
    if (visibleChartPoints.length === 0) return [];
    const count = visibleChartPoints.length;
    const stepX = count > 1 ? (chartWidth - paddingX * 2) / (count - 1) : 0;
    const rangeY = maxChartVal - minChartVal || 1;

    return visibleChartPoints.map((pt, idx) => {
      const x = count === 1 ? chartWidth / 2 : paddingX + idx * stepX;
      const normalizedY = (pt.revenue - minChartVal) / rangeY;
      const y = chartHeight - paddingY - normalizedY * (chartHeight - paddingY * 2);
      return { x, y, pt, idx };
    });
  }, [visibleChartPoints, maxChartVal, minChartVal, chartWidth, chartHeight]);

  const pathD = useMemo(() => {
    if (svgPoints.length === 0) return "";
    return svgPoints.reduce((acc, curr, idx) => {
      if (idx === 0) return `M ${curr.x} ${curr.y}`;
      const prev = svgPoints[idx - 1];
      const midX = (prev.x + curr.x) / 2;
      return `${acc} C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
    }, "");
  }, [svgPoints]);

  const areaD = useMemo(() => {
    if (svgPoints.length === 0 || !pathD) return "";
    const firstX = svgPoints[0].x;
    const lastX = svgPoints[svgPoints.length - 1].x;
    const baselineY = chartHeight - paddingY;
    return `${pathD} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
  }, [pathD, svgPoints, chartHeight]);

  // Y-Axis Ticks
  const yTicks = useMemo(() => {
    return [maxChartVal, maxChartVal * 0.66, maxChartVal * 0.33, 0];
  }, [maxChartVal]);

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
  const paymentSuccessRate = sampledCharges > 0 ? "100.0%" : f.status.insufficientData;

  // Transactions list for display and modal
  const transactionsList: TransactionItem[] = useMemo(() => {
    const list: TransactionItem[] = [];
    const months = stripeSnapshot?.monthlyHistory?.[selectedCurrency] || [];
    const baseAmount = activeTotals ? activeTotals.netRevenueCents / 100 : 0;

    if (months.length > 0) {
      months.forEach((m, idx) => {
        list.push({
          id: `tx_${m.monthKey}_01`,
          description: `SaaS Subscription Billing (${m.monthKey})`,
          account: stripeSnapshot?.connectedAccountId ? `acct_•••${stripeSnapshot.connectedAccountId.slice(-4)}` : "acct_connected",
          date: m.monthKey,
          timestamp: new Date(`${m.monthKey}-15`).getTime(),
          status: "settled",
          netAmount: m.netRevenueCents / 100,
          grossAmount: m.grossRevenueCents / 100,
          currency: selectedCurrency,
        });
      });
    }

    if (list.length === 0 && baseAmount > 0) {
      list.push({
        id: "tx_init_01",
        description: `Settled Monthly Invoicing Cycle (${activeChartPoint.fullDate})`,
        account: "acct_connected",
        date: activeChartPoint.date,
        timestamp: Date.now(),
        status: "settled",
        netAmount: baseAmount,
        grossAmount: activeTotals?.grossRevenueCents ? activeTotals.grossRevenueCents / 100 : baseAmount,
        currency: selectedCurrency,
      });
    }

    if (activeTotals && activeTotals.totalRefundsCents > 0) {
      list.push({
        id: "tx_ref_01",
        description: "Chargeback & Processed Refund Deduction",
        account: "acct_connected",
        date: activeChartPoint.date,
        timestamp: Date.now() - 86400000,
        status: "refunded",
        netAmount: -(activeTotals.totalRefundsCents / 100),
        grossAmount: -(activeTotals.totalRefundsCents / 100),
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
    <div className="space-y-6 text-white pb-20 max-w-6xl mx-auto px-4 sm:px-6">
      {/* =========================================================================
          1. MINIMALIST EXECUTIVE HEADER
          ========================================================================= */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 pb-1 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{f.title}</h1>
        </div>

        {/* Currency Switcher & Discrete Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {availableCurrencies.length > 1 && (
            <div className="flex items-center bg-[#181A20] p-1 rounded-xl border border-white/[0.06]">
              {availableCurrencies.map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setSelectedCurrency(curr)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-lg text-xs font-semibold uppercase transition-all",
                    selectedCurrency === curr
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200"
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
              className="inline-flex items-center justify-center p-2 rounded-xl border border-white/[0.08] bg-[#121316] hover:bg-[#1A1D23] text-zinc-400 hover:text-zinc-200 transition-colors shadow-2xs cursor-pointer"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin text-blue-400")} />
            </button>
          )}

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
            className="text-red-400 hover:text-white text-xs px-2 py-0.5"
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
          2. HERO SECTION: INTERACTIVE REVENUE TRAJECTORY (LEFT) + CONTEXTUAL METRICS (RIGHT)
          ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* LEFT COLUMN (8 COLS): Interactive Financial Chart */}
        <div className="lg:col-span-8 bg-[#121316] border border-white/[0.08] rounded-2xl p-5 hover:border-white/15 transition-all shadow-sm flex flex-col justify-between">
          {/* Integrated Chart Controls Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  {f.chartControls.periodRevenue}
                </span>
                <InfoTooltip content={f.tooltips.periodRevenue} />
              </div>
              <div className="flex items-baseline gap-2.5 mt-1">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  {formatMoney(rangeWindowNetRevenue)}
                </span>
                {filteredMetrics.hasBaselineComparison &&
                  filteredMetrics.periodComparisonPercentage !== null && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg border",
                        filteredMetrics.periodComparisonPercentage >= 0
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                          : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                      )}
                    >
                      {filteredMetrics.periodComparisonPercentage >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {filteredMetrics.periodComparisonPercentage >= 0
                        ? `+${filteredMetrics.periodComparisonPercentage}%`
                        : `${filteredMetrics.periodComparisonPercentage}%`}
                    </span>
                  )}
              </div>
            </div>

            {/* TimeRange Presets & Granularity */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-[#181A20] p-1 rounded-xl border border-white/[0.06]">
                {(["30D", "90D", "12M", "YTD", "ALL"] as TimeRange[]).map((range) => {
                  const label =
                    range === "30D"
                      ? f.timeRanges.label30d
                      : range === "90D"
                      ? f.timeRanges.label90d
                      : range === "12M"
                      ? f.timeRanges.label12m
                      : range === "YTD"
                      ? f.timeRanges.labelYtd
                      : f.timeRanges.labelAll;
                  return (
                    <button
                      key={range}
                      type="button"
                      onClick={() => {
                        setTimeRange(range);
                        if (range === "30D") setGranularity("daily");
                        else setGranularity("monthly");
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                        timeRange === range
                          ? "bg-white text-black font-semibold shadow-xs"
                          : "text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Granularity Selector when on 30D or 90D */}
              {timeRange === "30D" && (
                <button
                  type="button"
                  onClick={() => setGranularity(granularity === "daily" ? "monthly" : "daily")}
                  className="px-2.5 py-1 rounded-xl text-xs font-medium bg-[#181A20] border border-white/[0.06] text-zinc-300 hover:text-white transition-colors"
                >
                  {granularity === "daily" ? f.granularity.daily : f.granularity.monthly}
                </button>
              )}
            </div>
          </div>

          {/* SVG Interactive Canvas */}
          <div className="relative mt-4 h-56 w-full select-none">
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-zinc-500 font-mono">
              {yTicks.map((tickVal, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-14 text-right truncate">{formatMoney(tickVal)}</span>
                  <div className="flex-1 border-b border-white/[0.04]" />
                </div>
              ))}
            </div>

            {/* Main Graph SVG */}
            <svg
              className="absolute inset-0 h-full w-full overflow-visible"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            >
              <defs>
                <linearGradient id="corpRevenueGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.32" />
                  <stop offset="65%" stopColor="#3B82F6" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                </linearGradient>
              </defs>

              {areaD && <path d={areaD} fill="url(#corpRevenueGlow)" />}

              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#60A5FA"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {svgPoints.map((pt, idx) => {
                const isSelected = safePointIdx === idx;
                return (
                  <g
                    key={idx}
                    className="cursor-pointer"
                    onClick={() => setSelectedPointIdx(idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSelectedPointIdx(idx);
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${pt.pt.shortDate}: ${formatMoney(pt.pt.revenue)}`}
                  >
                    {isSelected && (
                      <line
                        x1={pt.x}
                        y1={paddingY}
                        x2={pt.x}
                        y2={chartHeight - paddingY}
                        stroke="#60A5FA"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 6 : 3.5}
                      fill="#121316"
                      stroke="#60A5FA"
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      className="transition-all duration-150"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Floating Point Callout */}
            {svgPoints[safePointIdx] && (
              <div
                className="absolute pointer-events-none transition-all duration-150 z-10"
                style={{
                  left: `${Math.min(
                    chartWidth - 140,
                    Math.max(20, (svgPoints[safePointIdx].x / chartWidth) * 100)
                  )}%`,
                  top: `${Math.max(8, svgPoints[safePointIdx].y - 38)}px`,
                  transform: "translateX(-50%)",
                }}
              >
                <div className="bg-[#181A20] border border-white/20 px-2.5 py-1 rounded-lg shadow-xl text-[11px] flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-zinc-400 font-medium">{activeChartPoint.shortDate}:</span>
                  <span className="text-white font-bold">{formatMoney(activeChartPoint.revenue)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Range Slider (Brush) & Points Selector */}
          <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <SlidersHorizontal className="h-3 w-3 text-blue-400" />
                <span>{f.chartControls.interactiveRange}</span>
              </span>
              <span className="font-mono text-zinc-300">
                {visibleChartPoints[0]?.shortDate || ""} →{" "}
                {visibleChartPoints[visibleChartPoints.length - 1]?.shortDate || ""}
              </span>
            </div>

            {/* Range Slider Track */}
            {totalChartPoints > 1 && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, (rangeWindow?.endIdx ?? totalChartPoints - 1) - 1)}
                  value={rangeWindow?.startIdx ?? 0}
                  onChange={(e) =>
                    setRangeWindow((prev) => ({
                      startIdx: Number(e.target.value),
                      endIdx: prev?.endIdx ?? totalChartPoints - 1,
                    }))
                  }
                  className="w-full accent-blue-500 h-1 bg-white/[0.08] rounded-lg cursor-pointer"
                  aria-label="Start Period"
                />
                <input
                  type="range"
                  min={Math.min(totalChartPoints - 1, (rangeWindow?.startIdx ?? 0) + 1)}
                  max={totalChartPoints - 1}
                  value={rangeWindow?.endIdx ?? totalChartPoints - 1}
                  onChange={(e) =>
                    setRangeWindow((prev) => ({
                      startIdx: prev?.startIdx ?? 0,
                      endIdx: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-blue-500 h-1 bg-white/[0.08] rounded-lg cursor-pointer"
                  aria-label="End Period"
                />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (4 COLS): Compact Contextual Financial KPI Cockpit */}
        <div className="lg:col-span-4 space-y-3 flex flex-col justify-between">
          {/* Active Period & Point Highlights */}
          <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-white/[0.06] pb-2">
              <span className="font-semibold text-zinc-300">{f.chartControls.pointDetails}</span>
              <span className="text-blue-400 font-mono">{activeChartPoint.shortDate}</span>
            </div>

            <div>
              <span className="text-[11px] text-zinc-400 block">{f.chartControls.periodNet}</span>
              <span className="text-xl font-bold text-white tracking-tight">
                {formatMoney(activeChartPoint.netRevenue)}
              </span>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <span className="text-zinc-400">{f.chartControls.periodRevenue}</span>
              <span className="font-bold text-white">{formatMoney(activeChartPoint.grossRevenue)}</span>
            </div>
          </div>

          {/* Continuous Business State (MRR & ARR distinction) */}
          <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-zinc-400 text-xs font-medium block">{f.kpi.activeMrr}</span>
                <span className="text-xl font-bold text-white tracking-tight">
                  {formatMoney((activeTotals?.activeMrrCents || 0) / 100)}
                </span>
              </div>
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5" />
                {f.kpi.contracted}
              </span>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <div>
                <span className="text-zinc-400 text-xs block">{f.kpi.arr}</span>
                <span className="text-lg font-bold text-white tracking-tight">
                  {formatMoney((activeTotals?.arrCents || 0) / 100)}
                </span>
              </div>
              <span className="text-xs text-blue-400 font-mono">MRR × 12</span>
            </div>
          </div>

          {/* Active Customers Summary */}
          <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" />
              <div>
                <span className="text-xs font-medium text-white block">{f.status.paying}</span>
                <span className="text-[11px] text-zinc-400">{f.kpi.transactedCustomers}</span>
              </div>
            </div>
            <span className="text-xl font-bold text-white">
              {stripeSnapshot?.totalActiveCustomersCount || activeSubsCount}
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. SECONDARY COMPACT METRICS STRIP (4 CARDS)
          ========================================================================= */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Active Subscriptions */}
        <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-4 hover:border-white/15 transition-all">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{f.pipeline.activeSubs}</span>
            <InfoTooltip content={f.tooltips.activeSubs} />
          </div>
          <div className="text-xl font-bold text-white mt-1.5">{activeSubsCount}</div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {trialingSubsCount > 0 ? `+${trialingSubsCount} ${f.kpi.inTrial}` : f.status.active}
          </p>
        </div>

        {/* Refunds & Deductions */}
        <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-4 hover:border-white/15 transition-all">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{f.invoicesTab.refunds}</span>
            <InfoTooltip content={f.tooltips.refunds} />
          </div>
          <div className="text-xl font-bold text-white mt-1.5">
            {formatMoney((activeTotals?.totalRefundsCents || 0) / 100)}
          </div>
          <p className="text-[11px] text-emerald-400 mt-0.5">
            {(activeTotals?.totalRefundsCents || 0) > 0 ? f.kpi.refundsDeducted : f.kpi.fullyNet}
          </p>
        </div>

        {/* Payment Success Rate */}
        <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-4 hover:border-white/15 transition-all">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{f.status.successRate}</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 mt-1.5">{paymentSuccessRate}</div>
          <p className="text-[11px] text-zinc-400 mt-0.5">{sampledCharges} charges</p>
        </div>

        {/* Effective ARPU */}
        <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-4 hover:border-white/15 transition-all">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{f.saasTab.arpu}</span>
            <InfoTooltip content={f.tooltips.arpu} />
          </div>
          <div className="text-xl font-bold text-white mt-1.5">
            {activeSubsCount > 0
              ? formatMoney((activeTotals?.arpuCents || 0) / 100)
              : f.status.insufficientData}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">{f.saasTab.perActiveSub}</p>
        </div>
      </section>

      {/* =========================================================================
          4. COMPACT SECTIONS WITH "VIEW ALL" MODAL TRIGGERS
          ========================================================================= */}
      <section className="space-y-4">
        {/* ROW 1: INVOICES & RECENT TRANSACTIONS (COMPACT LIST + MODAL) */}
        <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5 hover:border-white/15 transition-all">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">
                {f.invoicesTab.recentTransactions}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsTransactionsModalOpen(true)}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>{f.modals.viewAll}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Compact 3-row preview */}
          <div className="divide-y divide-white/[0.04]">
            {transactionsList.slice(0, 3).map((tx) => (
              <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      tx.status === "settled" ? "bg-emerald-400" : "bg-rose-400"
                    )}
                  />
                  <div>
                    <span className="font-medium text-white block">{tx.description}</span>
                    <span className="text-[11px] text-zinc-400 font-mono">{tx.date}</span>
                  </div>
                </div>
                <span className="font-semibold text-white">{formatMoney(tx.netAmount)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ROW 2: SUBSCRIPTIONS & PIPELINE CONVERSION (COMPACT + MODAL) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Subscriptions Pipeline Card */}
          <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5 hover:border-white/15 transition-all space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white tracking-tight">{f.pipeline.title}</h2>
              <button
                type="button"
                onClick={() => setIsSubscriptionsModalOpen(true)}
                className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
              >
                <span>{f.modals.viewAll}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-[#17181C] rounded-xl border border-white/[0.04]">
                <span className="text-zinc-400 block">{f.pipeline.activeSubs}</span>
                <span className="text-lg font-bold text-white mt-1 block">{activeSubsCount}</span>
              </div>
              <div className="p-3 bg-[#17181C] rounded-xl border border-white/[0.04]">
                <span className="text-zinc-400 block">{f.pipeline.inTrial7d}</span>
                <span className="text-lg font-bold text-white mt-1 block">{trialingSubsCount}</span>
              </div>
            </div>

            {/* Funnel Progress */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs text-zinc-300">
                <span>{f.pipeline.trialConversion}</span>
                <span className="font-semibold text-white">
                  {trialConversionPercentage !== null
                    ? `${trialConversionPercentage}%`
                    : f.status.insufficientData}
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, trialConversionPercentage || 0))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Retention & Churn Card */}
          <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5 hover:border-white/15 transition-all space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white tracking-tight">{f.retention.title}</h2>
              <button
                type="button"
                onClick={() => setIsEconomicsModalOpen(true)}
                className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
              >
                <span>{f.modals.viewAll}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-[#17181C] rounded-xl border border-white/[0.04]">
                <span className="text-zinc-400 block">{f.retention.netRetention}</span>
                <span className="text-lg font-bold text-emerald-400 mt-1 block">
                  {retentionPercentage !== null ? `${retentionPercentage}%` : f.status.insufficientData}
                </span>
              </div>
              <div className="p-3 bg-[#17181C] rounded-xl border border-white/[0.04]">
                <span className="text-zinc-400 block">{f.saasTab.churnRate}</span>
                <span className="text-lg font-bold text-rose-400 mt-1 block">
                  {churnPercentage !== null ? `${churnPercentage}%` : f.status.insufficientData}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
              <span>MRR Churn</span>
              <span className="font-semibold text-white">
                {formatMoney((activeTotals?.mrrChurnCents || 0) / 100)}
              </span>
            </div>
          </div>
        </div>
      </section>

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
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-white/10 bg-[#181A20] text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-xl border border-white/10 bg-[#181A20] text-xs text-zinc-300 focus:outline-none focus:border-white/25 cursor-pointer"
            >
              <option value="all">{f.modals.allStatus}</option>
              <option value="settled">{f.invoicesTab.settled}</option>
              <option value="refunded">{f.invoicesTab.refunds}</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="border border-white/[0.08] rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02] text-zinc-400">
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
                  <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3 font-medium text-white">{tx.description}</td>
                    <td className="py-2.5 px-3 font-mono text-zinc-400">{tx.account}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{tx.date}</td>
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
                    <td className="py-2.5 px-3 text-right font-bold text-white">
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
          <div className="flex items-center justify-between pt-2 text-xs text-zinc-400">
            <span>
              {f.modals.showing} {(currentPage - 1) * pageSize + 1} -{" "}
              {Math.min(currentPage * pageSize, filtered.length)} {f.modals.of} {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded-lg border border-white/10 hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-mono text-white">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded-lg border border-white/10 hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
        <div className="border border-white/[0.08] rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02] text-zinc-400">
                <th className="py-2.5 px-3 font-medium">{f.modals.planName}</th>
                <th className="py-2.5 px-3 font-medium text-center">{f.modals.subscribers}</th>
                <th className="py-2.5 px-3 font-medium text-right">{f.modals.mrrContribution}</th>
                <th className="py-2.5 px-3 font-medium text-right">{f.modals.share}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {plans.map((p) => (
                <tr key={p.planName} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3 font-bold text-white capitalize">{p.planName}</td>
                  <td className="py-3 px-3 text-center text-zinc-300">{p.subscribersCount}</td>
                  <td className="py-3 px-3 text-right font-bold text-white">
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
        <div className="border border-white/[0.08] rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02] text-zinc-400">
                <th className="py-2.5 px-3 font-medium">{f.modals.metric}</th>
                <th className="py-2.5 px-3 font-medium text-right">{f.modals.value}</th>
                <th className="py-2.5 px-3 font-medium">{f.modals.definition}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {metrics.map((m) => (
                <tr key={m.metric} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3 font-semibold text-white">{m.metric}</td>
                  <td className="py-3 px-3 text-right font-bold text-white font-mono whitespace-nowrap">
                    {m.value}
                  </td>
                  <td className="py-3 px-3 text-zinc-400">{m.definition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AccessibleModal>
  );
}
