"use client";

import * as React from "react";
import {
  X,
  Check,
  Calendar,
  Filter,
  Sparkles,
  AlertCircle,
  FileText,
  Clock,
  Eye,
  EyeOff,
  Search,
  TrendingUp,
} from "lucide-react";
import {
  PhosphorFolder,
  PhosphorGitBranch,
  PhosphorNetwork,
} from "@/components/icons";
import {
  WidgetInstanceConfig,
  WidgetSize,
  VisualizationType,
  TimeRange,
  ChartGranularity,
  DashboardType,
} from "@/lib/widgets/types";
import {
  getMetricCapability,
  getMetricsForDashboard,
} from "@/lib/widgets/registry";
import { useLanguage, resolveTranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { WidgetPreview } from "./widget-preview";

export interface WidgetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  dashboardType: DashboardType;
  editingWidget?: WidgetInstanceConfig | null;
  onSaveWidget: (widget: WidgetInstanceConfig) => void;
}

export function WidgetDrawer({
  isOpen,
  onClose,
  dashboardType,
  editingWidget,
  onSaveWidget,
}: WidgetDrawerProps) {
  const { t, locale } = useLanguage();

  // Metrics available for this dashboard
  const availableMetrics = React.useMemo(() => {
    return getMetricsForDashboard(dashboardType);
  }, [dashboardType]);

  // Search & Category Filter State
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedCategoryTab, setSelectedCategoryTab] = React.useState<string>("all");
  const [showPreview, setShowPreview] = React.useState<boolean>(false);

  // Form State
  const [selectedMetricId, setSelectedMetricId] = React.useState<string>(
    editingWidget?.metricId || availableMetrics[0]?.id || "workspace.pulse_kpis"
  );
  const [selectedVisualization, setSelectedVisualization] = React.useState<VisualizationType>(
    editingWidget?.visualization || "kpi"
  );
  const [selectedSize, setSelectedSize] = React.useState<WidgetSize>(
    editingWidget?.size || "md"
  );
  const [selectedTimeRange, setSelectedTimeRange] = React.useState<TimeRange>(
    editingWidget?.timeRange || "30D"
  );
  const [selectedGranularity, setSelectedGranularity] = React.useState<ChartGranularity>(
    editingWidget?.granularity || "monthly"
  );
  const [customTitle, setCustomTitle] = React.useState<string>(editingWidget?.title || "");
  const [selectedFilters, setSelectedFilters] = React.useState<Record<string, string>>(
    editingWidget?.filters || {}
  );
  const [rowBreak, setRowBreak] = React.useState<boolean>(!!editingWidget?.options?.rowBreak);
  const [customWidthPercent, setCustomWidthPercent] = React.useState<number>(
    editingWidget?.options?.customWidthPercent ||
      (editingWidget?.size === "sm" ? 25 : editingWidget?.size === "md" ? 50 : editingWidget?.size === "lg" ? 75 : 100)
  );
  const [customHeightPx, setCustomHeightPx] = React.useState<number>(
    editingWidget?.options?.customHeightPx || 300
  );

  // Categories list
  const categoryFilters = React.useMemo(
    () => [
      { id: "all", label: t.widgets.categoryAll },
      { id: "workspace", label: t.widgets.categoryWorkspace },
      { id: "finance", label: t.widgets.categoryFinance },
      { id: "pages", label: t.widgets.categoryPages },
      { id: "connections", label: t.widgets.categoryConnections },
      { id: "activity", label: t.widgets.categoryActivity },
      { id: "decisions", label: t.widgets.categoryDecisions },
    ],
    [t]
  );

  // Filtered metrics list based on category tab & search query
  const filteredMetrics = React.useMemo(() => {
    let list = availableMetrics;

    if (selectedCategoryTab === "finance") {
      list = list.filter((m) => m.category === "finance");
    } else if (selectedCategoryTab === "workspace") {
      list = list.filter((m) => m.category === "workspace");
    } else if (selectedCategoryTab === "pages") {
      list = list.filter((m) => m.id.includes("pages"));
    } else if (selectedCategoryTab === "connections") {
      list = list.filter((m) => m.id.includes("topology") || m.id.includes("connections"));
    } else if (selectedCategoryTab === "activity") {
      list = list.filter((m) => m.id.includes("timeline"));
    } else if (selectedCategoryTab === "decisions") {
      list = list.filter(
        (m) =>
          m.id.includes("decisions") ||
          m.id.includes("priorities") ||
          m.id.includes("projects")
      );
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((m) => {
      const label = (resolveTranslationKey(t, m.labelKey) || m.id).toLowerCase();
      const desc = (resolveTranslationKey(t, m.descriptionKey) || "").toLowerCase();
      return label.includes(q) || desc.includes(q) || m.id.toLowerCase().includes(q);
    });
  }, [availableMetrics, selectedCategoryTab, searchQuery, t]);

  // Sync state when modal opens or editingWidget changes
  React.useEffect(() => {
    if (!isOpen) return;

    if (editingWidget) {
      setSelectedMetricId(editingWidget.metricId);
      setSelectedVisualization(editingWidget.visualization);
      setSelectedSize(editingWidget.size);
      setSelectedTimeRange(editingWidget.timeRange || "30D");
      setSelectedGranularity(editingWidget.granularity || "monthly");
      setCustomTitle(editingWidget.title || "");
      setSelectedFilters(editingWidget.filters || {});
      setRowBreak(!!editingWidget.options?.rowBreak);
      setCustomWidthPercent(
        editingWidget.options?.customWidthPercent ||
          (editingWidget.size === "sm" ? 25 : editingWidget.size === "md" ? 50 : editingWidget.size === "lg" ? 75 : 100)
      );
      setCustomHeightPx(editingWidget.options?.customHeightPx || 300);
      setShowPreview(false);
    } else {
      const defaultMetric = availableMetrics[0];
      if (defaultMetric) {
        setSelectedMetricId(defaultMetric.id);
        setSelectedVisualization(defaultMetric.supportedVisualizers[0] || "kpi");
        setSelectedSize(defaultMetric.defaultSize || "md");
        setSelectedTimeRange(defaultMetric.supportedTimeRanges[0] || "current");
        setSelectedGranularity("monthly");
        setCustomTitle("");
        setSelectedFilters({});
        setRowBreak(false);
        setCustomWidthPercent(50);
        setCustomHeightPx(300);
        setShowPreview(false);
      }
    }
  }, [isOpen, editingWidget, availableMetrics]);

  // Escape key handler & scroll lock
  React.useEffect(() => {
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

  // Current metric capability
  const currentCapability = getMetricCapability(selectedMetricId);

  // When selected metric changes, auto-adjust dependent settings
  const handleSelectMetric = (metricId: string) => {
    setSelectedMetricId(metricId);
    const cap = getMetricCapability(metricId);
    if (!cap) return;

    if (!cap.supportedVisualizers.includes(selectedVisualization)) {
      setSelectedVisualization(cap.supportedVisualizers[0] || "kpi");
    }

    if (!cap.allowedSizes.includes(selectedSize)) {
      setSelectedSize(cap.defaultSize || cap.allowedSizes[0] || "md");
    }

    if (!cap.supportedTimeRanges.includes(selectedTimeRange)) {
      setSelectedTimeRange(cap.supportedTimeRanges[0] || "current");
    }

    setSelectedFilters({});
  };

  // Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let computedSize: WidgetSize = selectedSize;
    if (customWidthPercent <= 35) computedSize = "sm";
    else if (customWidthPercent <= 60) computedSize = "md";
    else if (customWidthPercent <= 85) computedSize = "lg";
    else computedSize = "full";

    const finalWidget: WidgetInstanceConfig = {
      id:
        editingWidget?.id ||
        `widget_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      metricId: selectedMetricId,
      visualization: selectedVisualization,
      size: computedSize,
      timeRange: selectedTimeRange,
      granularity: selectedGranularity,
      title: customTitle.trim() || undefined,
      filters: Object.keys(selectedFilters).length > 0 ? selectedFilters : undefined,
      options: {
        ...editingWidget?.options,
        rowBreak,
        customWidthPercent,
        customHeightPx,
      },
    };

    onSaveWidget(finalWidget);
    onClose();
  };

  const getVisualizationLabel = (vis: VisualizationType): string => {
    switch (vis) {
      case "kpi":
        return t.widgets.visKpi;
      case "chart":
        return t.widgets.visChart;
      case "bar":
        return t.widgets.visBar;
      case "table":
        return t.widgets.visTable;
      case "priorities":
        return t.widgets.visPriorities;
      case "pulse_kpis":
        return t.widgets.visPulseKpis || "Cartões de Pulso";
      case "strip":
        return t.widgets.visStrip || "Faixa de Resumo";
      case "topology":
        return t.widgets.visTopology || "Mapa de Topologia";
      case "pages":
        return t.widgets.visPages || "Lista de Páginas";
      case "timeline":
        return t.widgets.visTimeline || "Linha Temporal";
      case "progress":
        return t.widgets.visProgress;
      case "gauge":
        return t.widgets.visGauge;
      case "agenda":
        return t.widgets.visAgenda;
      case "cards":
        return t.widgets.visCards;
    }
  };

  const getVisualizerThumbnail = (vis: VisualizationType) => {
    switch (vis) {
      case "kpi":
        return <span className="font-mono font-bold text-xs tracking-tight"># 123</span>;
      case "chart":
        return (
          <svg className="w-5 h-3.5" viewBox="0 0 20 12" fill="none">
            <path
              d="M1 10 Q5 7 9 5 T15 3 T19 1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        );
      case "bar":
        return (
          <svg className="w-5 h-3.5" viewBox="0 0 20 12" fill="none">
            <rect x="2" y="6" width="3" height="6" rx="0.5" fill="currentColor" opacity="0.6" />
            <rect x="8" y="2" width="3" height="10" rx="0.5" fill="currentColor" />
            <rect x="14" y="4" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.8" />
          </svg>
        );
      case "table":
        return (
          <svg className="w-5 h-3.5" viewBox="0 0 20 12" fill="none">
            <line x1="1" y1="3" x2="19" y2="3" stroke="currentColor" strokeWidth="1.5" />
            <line x1="1" y1="7" x2="19" y2="7" stroke="currentColor" strokeWidth="1" strokeOpacity="0.7" />
            <line x1="1" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="1" strokeOpacity="0.7" />
          </svg>
        );
      case "priorities":
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case "pulse_kpis":
        return (
          <div className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5">
            <div className="bg-current rounded-xs opacity-70" />
            <div className="bg-current rounded-xs opacity-70" />
            <div className="bg-current rounded-xs opacity-70" />
            <div className="bg-current rounded-xs opacity-70" />
          </div>
        );
      case "strip":
        return (
          <div className="w-5 h-2.5 rounded-xs border border-current flex items-center justify-between px-0.5">
            <div className="w-1.5 h-1.5 bg-current rounded-xs" />
            <div className="w-1.5 h-1.5 bg-current opacity-60 rounded-xs" />
          </div>
        );
      case "topology":
        return <PhosphorNetwork className="w-4 h-4 text-indigo-400" />;
      case "pages":
        return <FileText className="w-4 h-4 text-purple-400" />;
      case "timeline":
        return <Clock className="w-4 h-4 text-emerald-400" />;
      case "progress":
        return (
          <div className="w-5 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
            <div className="w-3/5 h-full bg-blue-500 rounded-full" />
          </div>
        );
      case "gauge":
        return (
          <svg className="w-5 h-3.5" viewBox="0 0 20 12" fill="none">
            <path d="M2 11 A8 8 0 0 1 18 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="10" y1="11" x2="14" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      case "agenda":
        return <Calendar className="w-4 h-4 text-blue-400" />;
      case "cards":
        return (
          <div className="flex gap-0.5 w-4 h-3">
            <div className="w-1.5 h-full bg-current rounded-xs opacity-80" />
            <div className="w-1.5 h-full bg-current rounded-xs opacity-50" />
          </div>
        );
    }
  };

  const getMetricIcon = (metricId: string) => {
    if (metricId.includes("pages")) return <FileText className="h-4 w-4 text-purple-400 shrink-0" />;
    if (metricId.includes("topology") || metricId.includes("connections"))
      return <PhosphorNetwork className="h-4 w-4 text-indigo-400 shrink-0" />;
    if (metricId.includes("timeline")) return <Clock className="h-4 w-4 text-emerald-400 shrink-0" />;
    if (metricId.includes("priorities")) return <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />;
    if (metricId.includes("projects")) return <PhosphorFolder className="h-4 w-4 text-blue-400 shrink-0" />;
    if (metricId.includes("decisions")) return <PhosphorGitBranch className="h-4 w-4 text-amber-400 shrink-0" />;
    return <TrendingUp className="h-4 w-4 text-blue-400 shrink-0" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered Spacious Dialog */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6 text-center">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-2xl bg-white dark:bg-[#15171C] border border-zinc-200 dark:border-white/[0.08] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-left relative z-10 animate-in fade-in-0 zoom-in-95 duration-200"
        >
          {/* 1. Header (Clean, zero bubbles, zero clutter) */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-white/[0.08] bg-zinc-50/60 dark:bg-[#121316]">
            <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
              {editingWidget ? t.widgets.drawerTitleEdit : t.widgets.drawerTitleAdd}
            </h2>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 2. Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            <form id="widget-modal-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Optional Custom Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>{t.widgets.customTitle}</span>
                  <span className="text-[10px] text-zinc-400 font-normal">
                    {customTitle ? `${customTitle.length}/60` : ""}
                  </span>
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  maxLength={60}
                  placeholder={
                    currentCapability?.labelKey
                      ? resolveTranslationKey(t, currentCapability.labelKey)
                      : "Ex: My Block"
                  }
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors shadow-2xs"
                />
              </div>

              {/* Search Bar & Unified Categories */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.widgets.searchMetrics}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 pl-9 pr-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 text-xs"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Category Chips */}
                <div className="flex flex-wrap gap-1 text-xs">
                  {categoryFilters.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryTab(cat.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer",
                        selectedCategoryTab === cat.id
                          ? "bg-blue-600 text-white font-semibold shadow-2xs"
                          : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metric Card Explorer */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {filteredMetrics.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                    {t.widgets.noMetricsFound}
                  </div>
                ) : (
                  filteredMetrics.map((metric) => {
                    const isSelected = metric.id === selectedMetricId;

                    return (
                      <div
                        key={metric.id}
                        onClick={() => handleSelectMetric(metric.id)}
                        className={cn(
                          "flex items-start gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition-all",
                          isSelected
                            ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                        )}
                      >
                        <div className="mt-0.5">{getMetricIcon(metric.id)}</div>

                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {resolveTranslationKey(t, metric.labelKey) || metric.id}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                            {resolveTranslationKey(t, metric.descriptionKey) ||
                              `${metric.unit.toUpperCase()} • ${metric.timeSemantics}`}
                          </p>
                        </div>

                        {isSelected && (
                          <div className="h-4 w-4 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Visualization Formats */}
              {currentCapability && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                    <span>{t.widgets.visualizationType}</span>
                    <span className="text-[11px] text-zinc-400 font-normal">
                      {currentCapability.supportedVisualizers.length} {t.widgets.availableFormats}
                    </span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {currentCapability.supportedVisualizers.map((vis) => {
                      const isSelected = vis === selectedVisualization;

                      return (
                        <button
                          key={vis}
                          type="button"
                          onClick={() => setSelectedVisualization(vis)}
                          className={cn(
                            "p-2.5 rounded-xl border text-xs text-left transition-all cursor-pointer flex flex-col justify-between gap-2",
                            isSelected
                              ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 text-blue-600 dark:text-blue-300 shadow-2xs ring-1 ring-blue-500"
                              : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-[#121316]"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className={isSelected ? "text-blue-500" : "text-zinc-500"}>
                              {getVisualizerThumbnail(vis)}
                            </span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-blue-500" />}
                          </div>

                          <span className="font-semibold tracking-tight text-[11px] truncate">
                            {getVisualizationLabel(vis)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Time Range Selector (if multiple supported) */}
              {currentCapability && currentCapability.supportedTimeRanges.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                    <span>{t.widgets.timeWindow}</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {currentCapability.supportedTimeRanges.map((range) => {
                      const isSelected = range === selectedTimeRange;

                      return (
                        <button
                          key={range}
                          type="button"
                          onClick={() => setSelectedTimeRange(range)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors cursor-pointer",
                            isSelected
                              ? "border-blue-500 bg-blue-600 text-white font-semibold"
                              : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"
                          )}
                        >
                          {range}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Granularity (Daily vs Monthly) */}
              {selectedVisualization === "chart" &&
                currentCapability?.hasHistoricalPoints &&
                selectedTimeRange === "30D" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {t.widgets.granularity}
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedGranularity("monthly")}
                        className={cn(
                          "p-2 rounded-lg border text-xs font-medium text-center transition-colors cursor-pointer",
                          selectedGranularity === "monthly"
                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-semibold"
                            : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                        )}
                      >
                        {t.widgets.granularityMonthly}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedGranularity("daily")}
                        className={cn(
                          "p-2 rounded-lg border text-xs font-medium text-center transition-colors cursor-pointer",
                          selectedGranularity === "daily"
                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-semibold"
                            : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                        )}
                      >
                        {t.widgets.granularityDaily}
                      </button>
                    </div>
                  </div>
                )}

              {/* Entity Filters */}
              {currentCapability?.supportedFilters &&
                currentCapability.supportedFilters.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-white/[0.04]">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Filter className="h-3.5 w-3.5 text-zinc-400" />
                      <span>{t.widgets.entityFilters}</span>
                    </label>
                    {currentCapability.supportedFilters.map((flt) => (
                      <div key={flt.key} className="space-y-1">
                        <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono">
                          {resolveTranslationKey(t, flt.labelKey) || flt.key}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {flt.options.map((opt) => {
                            const activeVal = selectedFilters[flt.key] || "all";
                            const isSelected = activeVal === opt.value;

                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() =>
                                  setSelectedFilters({
                                    ...selectedFilters,
                                    [flt.key]: opt.value,
                                  })
                                }
                                className={cn(
                                  "px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer",
                                  isSelected
                                    ? "border-blue-500 bg-blue-600 text-white font-semibold"
                                    : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"
                                )}
                              >
                                {resolveTranslationKey(t, opt.labelKey) || opt.value}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              {/* Live Preview Toggle / Expander */}
              <div className="pt-2 border-t border-zinc-100 dark:border-white/[0.04] space-y-3">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  <span>{showPreview ? "Ocultar" : t.widgets.livePreview}</span>
                </button>

                {showPreview && (
                  <div className="animate-in fade-in-0 duration-200">
                    <WidgetPreview
                      metricId={selectedMetricId}
                      visualization={selectedVisualization}
                      size={selectedSize}
                      title={customTitle}
                      timeRange={selectedTimeRange}
                      granularity={selectedGranularity}
                    />
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* 3. Modal Footer Actions */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-zinc-200 dark:border-white/[0.08] bg-zinc-50/60 dark:bg-[#121316]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {t.widgets.cancel}
            </button>

            <button
              type="submit"
              form="widget-modal-form"
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{editingWidget ? t.widgets.updateWidget : t.widgets.addToDashboard}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
