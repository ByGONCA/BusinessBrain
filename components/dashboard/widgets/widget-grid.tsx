"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { WidgetInstanceConfig, WidgetSize } from "@/lib/widgets/types";
import { WidgetContainer } from "./widget-container";
import { KpiVisualizer } from "./renderers/kpi-visualizer";
import { ChartVisualizer } from "./renderers/chart-visualizer";
import { BarVisualizer } from "./renderers/bar-visualizer";
import { TableVisualizer } from "./renderers/table-visualizer";
import { PrioritiesVisualizer, PriorityVisualizerItem } from "./renderers/priorities-visualizer";
import { PulseKpisVisualizer } from "./renderers/pulse-kpis-visualizer";
import { PulseStripVisualizer } from "./renderers/pulse-strip-visualizer";
import { TopologyMapVisualizer } from "./renderers/topology-map-visualizer";
import { RecentPagesVisualizer } from "./renderers/recent-pages-visualizer";
import { TimelineActivityVisualizer } from "./renderers/timeline-activity-visualizer";
import { StripeFinancialSnapshot, MetricFreshnessStatus } from "@/lib/integrations/stripe/types";
import { CompanyGraphData } from "@/lib/connections/types";
import { TimelineEvent } from "@/lib/timeline/types";
import { LayoutGrid } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export interface WidgetGridData {
  financialSnapshot?: StripeFinancialSnapshot | null;
  isStripeConnected?: boolean;
  stripeStatus?: MetricFreshnessStatus;
  priorityItems?: PriorityVisualizerItem[];
  projects?: Array<{ id: string; title: string; status?: string; updated_at?: string; created_at?: string }>;
  projectsCount?: number;
  decisions?: Array<{ id: string; title: string; status?: string; updated_at: string; created_at?: string; metadata?: Record<string, unknown> }>;
  decisionsCount?: number;
  pages?: Array<{ id: string; title: string; icon?: string | null; updated_at: string }>;
  pagesCount?: number;
  connectionCount?: number;
  totalConnections?: number;
  graphData?: CompanyGraphData;
  timelineEvents?: TimelineEvent[];
  currency?: string;
  onRecordVisit?: (item: any) => void;
  onDemoNavigate?: (href: string) => void;
  demoMode?: boolean;
}

export interface WidgetGridProps {
  widgets: WidgetInstanceConfig[];
  data?: WidgetGridData;
  isEditing?: boolean;
  onResizeWidget?: (widgetId: string, newSize: WidgetSize) => void;
  onEditWidget?: (widget: WidgetInstanceConfig) => void;
  onRemoveWidget?: (widgetId: string) => void;
  onReorderWidgets?: (newWidgets: WidgetInstanceConfig[]) => void;
  onAddWidgetPrompt?: () => void;
  className?: string;
}

const SIZE_COLUMN_CLASSES: Record<WidgetSize, string> = {
  sm: "col-span-1",
  md: "col-span-1 sm:col-span-2",
  lg: "col-span-1 sm:col-span-2 lg:col-span-3",
  full: "col-span-1 sm:col-span-2 lg:col-span-4",
};

export function WidgetGrid({
  widgets,
  data = {},
  isEditing = false,
  onResizeWidget,
  onEditWidget,
  onRemoveWidget,
  onReorderWidgets,
  onAddWidgetPrompt,
  className,
}: WidgetGridProps) {
  const { t } = useLanguage();
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
  const [activeTabs, setActiveTabs] = React.useState<Record<string, string | undefined>>({});

  // Move a widget left (decrement index)
  const handleMoveLeft = (index: number) => {
    if (index <= 0 || !onReorderWidgets) return;
    const reordered = [...widgets];
    const temp = reordered[index - 1];
    reordered[index - 1] = reordered[index];
    reordered[index] = temp;
    onReorderWidgets(reordered);
  };

  // Move a widget right (increment index)
  const handleMoveRight = (index: number) => {
    if (index >= widgets.length - 1 || !onReorderWidgets) return;
    const reordered = [...widgets];
    const temp = reordered[index + 1];
    reordered[index + 1] = reordered[index];
    reordered[index] = temp;
    onReorderWidgets(reordered);
  };

  // Split a widget in half (50/50 dual column)
  const handleSplitInHalf = (widgetId: string) => {
    if (!onReorderWidgets) return;
    const index = widgets.findIndex((w) => w.id === widgetId);
    if (index === -1) return;

    const current = widgets[index];
    const updatedCurrent: WidgetInstanceConfig = {
      ...current,
      size: "md", // 50% width
      options: {
        ...current.options,
        rowBreak: false,
      },
    };

    const partnerId = `w_split_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const partnerWidget: WidgetInstanceConfig = {
      id: partnerId,
      metricId: current.metricId === "workspace.priorities" ? "workspace.projects" : "workspace.priorities",
      visualization: current.metricId === "workspace.priorities" ? "table" : "priorities",
      size: "md", // 50% width sits right next to it!
      title: undefined,
      options: {
        rowBreak: false,
      },
    };

    const reordered = [...widgets];
    reordered.splice(index, 1, updatedCurrent, partnerWidget);
    onReorderWidgets(reordered);
  };

  // Toggle row break (side-by-side vs new row below)
  const handleToggleRowBreak = (widgetId: string) => {
    if (!onReorderWidgets) return;
    const nextWidgets = widgets.map((w) => {
      if (w.id !== widgetId) return w;
      return {
        ...w,
        options: {
          ...w.options,
          rowBreak: !w.options?.rowBreak,
        },
      };
    });
    onReorderWidgets(nextWidgets);
  };

  // Change height
  const handleChangeHeight = (widgetId: string, newHeight: "compact" | "normal" | "tall") => {
    if (!onReorderWidgets) return;
    const nextWidgets = widgets.map((w) => {
      if (w.id !== widgetId) return w;
      return {
        ...w,
        options: {
          ...w.options,
          customHeight: newHeight,
        },
      };
    });
    onReorderWidgets(nextWidgets);
  };

  // 100% custom width, height and position resizing
  const handleResizeCustom = (
    widgetId: string,
    widthPercent?: number,
    heightPx?: number,
    align?: "left" | "center" | "right",
    offsetXPercent?: number
  ) => {
    if (!onReorderWidgets) return;
    const nextWidgets = widgets.map((w) => {
      if (w.id !== widgetId) return w;
      const targetWidth =
        widthPercent ??
        w.options?.customWidthPercent ??
        (w.size === "sm" ? 25 : w.size === "md" ? 50 : w.size === "lg" ? 75 : 100);
      const targetHeight = heightPx ?? w.options?.customHeightPx ?? 300;
      const targetAlign = align ?? w.options?.align ?? "left";
      const targetOffset = offsetXPercent ?? w.options?.offsetXPercent ?? 0;

      let newSize: WidgetSize = w.size;
      if (targetWidth <= 35) newSize = "sm";
      else if (targetWidth <= 60) newSize = "md";
      else if (targetWidth <= 85) newSize = "lg";
      else newSize = "full";

      return {
        ...w,
        size: newSize,
        options: {
          ...w.options,
          customWidthPercent: targetWidth,
          customHeightPx: targetHeight,
          align: targetAlign,
          offsetXPercent: targetOffset,
        },
      };
    });
    onReorderWidgets(nextWidgets);
  };

  // Add tab to widget container
  const handleAddTab = (widgetId: string) => {
    if (!onReorderWidgets) return;
    const newTabId = `tab_${Date.now()}`;
    const nextWidgets = widgets.map((w) => {
      if (w.id !== widgetId) return w;
      const currentTabs = w.options?.tabs || [];
      const defaultMetric = w.metricId === "workspace.priorities" ? "workspace.projects" : "workspace.timeline_activity";
      const newTab = {
        id: newTabId,
        label: `Aba ${currentTabs.length + 2}`,
        metricId: defaultMetric,
        visualization: "table" as const,
      };
      return {
        ...w,
        options: {
          ...w.options,
          tabs: [...currentTabs, newTab],
          activeTabId: newTabId,
        },
      };
    });
    onReorderWidgets(nextWidgets);
    setActiveTabs((prev) => ({ ...prev, [widgetId]: newTabId }));
  };

  const handleSelectTab = (widgetId: string, tabId?: string) => {
    setActiveTabs((prev) => ({ ...prev, [widgetId]: tabId }));
  };

  // Drag and drop handlers
  const handleDragStart = (index: number, e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex || !onReorderWidgets) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...widgets];
    const [movedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, movedItem);

    onReorderWidgets(reordered);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Empty state if layout has no widgets
  if (widgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-white/[0.01]">
        <LayoutGrid className="h-8 w-8 text-zinc-400 mb-2" />
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {t.widgets.emptyTitle}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
          {t.widgets.emptyDesc}
        </p>
        {onAddWidgetPrompt && (
          <button
            type="button"
            onClick={onAddWidgetPrompt}
            className="mt-4 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            + {t.widgets.addWidget}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      data-grid-container="true"
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 transition-all dashboard-grid-container",
        className
      )}
    >
      {widgets.map((widget, index) => {
        const isRowBreak = widget.options?.rowBreak;
        const hasCustomWidth = typeof widget.options?.customWidthPercent === "number";
        const hasCustomOffset =
          typeof widget.options?.offsetXPercent === "number" && widget.options.offsetXPercent > 0;
        const isCentered = widget.options?.align === "center";
        const isRight = widget.options?.align === "right";

        const needsFullRow =
          isRowBreak ||
          hasCustomOffset ||
          isCentered ||
          isRight ||
          (hasCustomWidth && (widget.options?.customWidthPercent || 0) > 50);

        const spanClass = cn(
          needsFullRow
            ? "col-span-1 sm:col-span-2 lg:col-span-4"
            : (SIZE_COLUMN_CLASSES[widget.size] || "col-span-1 sm:col-span-2"),
          isRowBreak && "col-start-1 clear-left"
        );

        // Dynamic Tab resolution
        const currentActiveTabId = activeTabs[widget.id];
        const activeTabConfig = widget.options?.tabs?.find((t) => t.id === currentActiveTabId);
        const resolvedVisualization = activeTabConfig?.visualization || widget.visualization;
        const resolvedWidget = activeTabConfig
          ? { ...widget, metricId: activeTabConfig.metricId, visualization: resolvedVisualization }
          : widget;

        return (
          <div key={widget.id} className={cn("transition-all duration-200", spanClass)}>
            <WidgetContainer
              widget={widget}
              isEditing={isEditing}
              canMoveLeft={index > 0}
              canMoveRight={index < widgets.length - 1}
              onMoveLeft={() => handleMoveLeft(index)}
              onMoveRight={() => handleMoveRight(index)}
              onResize={(newSize) => onResizeWidget?.(widget.id, newSize)}
              onResizeCustom={(wP, hP, al, offX) => handleResizeCustom(widget.id, wP, hP, al, offX)}
              onToggleRowBreak={() => handleToggleRowBreak(widget.id)}
              onSplitInHalf={() => handleSplitInHalf(widget.id)}
              onChangeHeight={(newHeight) => handleChangeHeight(widget.id, newHeight)}
              onAddTab={() => handleAddTab(widget.id)}
              onSelectTab={(tabId) => handleSelectTab(widget.id, tabId)}
              activeTabId={currentActiveTabId}
              onEdit={() => onEditWidget?.(widget)}
              onRemove={() => onRemoveWidget?.(widget.id)}
              draggable={isEditing}
              onDragStart={(e) => handleDragStart(index, e)}
              onDragOver={(e) => handleDragOver(index, e)}
              onDrop={(e) => handleDrop(index, e)}
              onDragEnd={handleDragEnd}
              isDragging={draggedIndex === index}
              isDragOver={dragOverIndex === index && draggedIndex !== index}
            >
              {/* Dynamic Visualizer Resolution */}
              {resolvedVisualization === "kpi" && (
                <KpiVisualizer
                  widget={resolvedWidget}
                  financialSnapshot={data.financialSnapshot}
                  currency={data.currency}
                  projectsCount={data.projectsCount}
                  decisionsCount={data.decisionsCount}
                  pagesCount={data.pagesCount}
                  connectionCount={data.connectionCount}
                  totalConnections={data.totalConnections}
                />
              )}

              {resolvedVisualization === "chart" && (
                <ChartVisualizer
                  widget={resolvedWidget}
                  financialSnapshot={data.financialSnapshot}
                  currency={data.currency}
                />
              )}

              {resolvedVisualization === "bar" && (
                <BarVisualizer
                  widget={resolvedWidget}
                  financialSnapshot={data.financialSnapshot}
                  currency={data.currency}
                />
              )}

              {resolvedVisualization === "table" && (
                <TableVisualizer
                  widget={resolvedWidget}
                  projects={data.projects}
                  decisions={data.decisions}
                />
              )}

              {resolvedVisualization === "priorities" && (
                <PrioritiesVisualizer
                  widget={resolvedWidget}
                  priorityItems={data.priorityItems}
                />
              )}

              {resolvedVisualization === "pulse_kpis" && (
                <PulseKpisVisualizer
                  widget={resolvedWidget}
                  projectsCount={data.projectsCount}
                  decisionsCount={data.decisionsCount}
                  pagesCount={data.pagesCount}
                  connectionCount={data.connectionCount}
                  totalConnections={data.totalConnections}
                  onDemoNavigate={data.onDemoNavigate}
                  demoMode={data.demoMode}
                />
              )}

              {resolvedVisualization === "strip" && (
                <PulseStripVisualizer
                  widget={resolvedWidget}
                  financialSnapshot={data.financialSnapshot}
                  isStripeConnected={data.isStripeConnected}
                  stripeStatus={data.stripeStatus}
                  currency={data.currency}
                  onDemoNavigate={data.onDemoNavigate}
                  demoMode={data.demoMode}
                />
              )}

              {resolvedVisualization === "topology" && (
                <TopologyMapVisualizer
                  widget={resolvedWidget}
                  graphData={data.graphData}
                  connectionCount={data.connectionCount}
                  pagesCount={data.pagesCount}
                  decisionsCount={data.decisionsCount}
                  projectsCount={data.projectsCount}
                  onDemoNavigate={data.onDemoNavigate}
                  demoMode={data.demoMode}
                />
              )}

              {resolvedVisualization === "pages" && (
                <RecentPagesVisualizer
                  widget={resolvedWidget}
                  pages={data.pages}
                  onRecordVisit={data.onRecordVisit}
                  onDemoNavigate={data.onDemoNavigate}
                  demoMode={data.demoMode}
                />
              )}

              {resolvedVisualization === "timeline" && (
                <TimelineActivityVisualizer
                  widget={resolvedWidget}
                  timelineEvents={data.timelineEvents}
                  onDemoNavigate={data.onDemoNavigate}
                  demoMode={data.demoMode}
                />
              )}

              {/* 11. PROGRESS VISUALIZER */}
              {resolvedVisualization === "progress" && (
                <div className="p-4 flex flex-col justify-between h-full space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                        {resolvedWidget.metricId.includes("finance") ? "Meta de Faturação" : "Conclusão de Objetivos"}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-0.5">Progresso do Período</h4>
                    </div>
                    <span className="text-xl font-mono font-extrabold text-blue-400">
                      {resolvedWidget.metricId.includes("finance") ? "84%" : "72%"}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="h-3 w-full rounded-full bg-zinc-800/80 overflow-hidden p-0.5 border border-white/[0.06]">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: resolvedWidget.metricId.includes("finance") ? "84%" : "72%" }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                      <span>0%</span>
                      <span>Meta: 100%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 12. GAUGE VISUALIZER */}
              {resolvedVisualization === "gauge" && (
                <div className="p-4 flex flex-col items-center justify-center h-full text-center">
                  <div className="relative flex items-center justify-center">
                    <svg className="w-36 h-20" viewBox="0 0 100 60">
                      <path
                        d="M10 50 A40 40 0 0 1 90 50"
                        fill="none"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M10 50 A40 40 0 0 1 78 20"
                        fill="none"
                        stroke="#3B82F6"
                        strokeWidth="8"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute bottom-1 text-center">
                      <span className="text-2xl font-mono font-black text-white">88%</span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-zinc-300 mt-2">Velocidade & Pulso Operacional</span>
                  <span className="text-[11px] text-zinc-500">Ritmo de entrega acima da média trimestral</span>
                </div>
              )}

              {/* 13. AGENDA VISUALIZER */}
              {resolvedVisualization === "agenda" && (
                <div className="p-4 space-y-2.5 h-full overflow-y-auto">
                  <span className="text-[11px] font-mono uppercase text-zinc-400 tracking-wider">
                    Próximos Marcos & Sincronizações
                  </span>
                  <div className="space-y-2 pt-1">
                    {(data.timelineEvents && data.timelineEvents.length > 0
                      ? data.timelineEvents.slice(0, 3)
                      : [
                          { id: "e1", title: "Revisão Executiva Q4", timestamp: new Date().toISOString() },
                          { id: "e2", title: "Lançamento da API Stripe", timestamp: new Date().toISOString() },
                        ]
                    ).map((evt: any, i: number) => (
                      <div
                        key={evt.id || i}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]"
                      >
                        <div className="flex flex-col items-center justify-center px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-mono text-[10px] font-bold shrink-0">
                          <span>DIA</span>
                          <span>{new Date(evt.timestamp).getDate()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-zinc-200 truncate">{evt.title}</p>
                          <p className="text-[10px] text-zinc-400">
                            {new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 14. CARDS VISUALIZER */}
              {resolvedVisualization === "cards" && (
                <div className="p-4 space-y-2.5 h-full overflow-y-auto">
                  <span className="text-[11px] font-mono uppercase text-zinc-400 tracking-wider">
                    Cartões de Memória & Insights
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {(data.decisions && data.decisions.length > 0
                      ? data.decisions.slice(0, 4)
                      : (data.projects || []).slice(0, 4)
                    ).map((item: any, i: number) => (
                      <div
                        key={item.id || i}
                        className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                      >
                        <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400">
                          {item.type || "Registo"}
                        </span>
                        <p className="text-xs font-semibold text-zinc-200 truncate mt-0.5">{item.title}</p>
                        <span className="text-[10px] text-zinc-500 mt-1 block">
                          {new Date(item.created_at || item.updated_at || Date.now()).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </WidgetContainer>
          </div>
        );
      })}
    </div>
  );
}
