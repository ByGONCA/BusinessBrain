"use client";

import * as React from "react";
import {
  AlertTriangle,
  Pencil,
  Trash2,
  Columns2,
  ArrowDownToLine,
  SlidersHorizontal,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WidgetInstanceConfig, WidgetSize } from "@/lib/widgets/types";
import { getMetricCapability } from "@/lib/widgets/registry";
import { useLanguage, resolveTranslationKey } from "@/lib/i18n";

interface WidgetContainerProps {
  widget: WidgetInstanceConfig;
  title?: string;
  subtitle?: string;
  isEditing?: boolean;
  onResize?: (newSize: WidgetSize) => void;
  onResizeCustom?: (
    widthPercent?: number,
    heightPx?: number,
    align?: "left" | "center" | "right",
    offsetXPercent?: number
  ) => void;
  onToggleRowBreak?: () => void;
  onSplitInHalf?: () => void;
  onChangeHeight?: (newHeight: "compact" | "normal" | "tall") => void;
  onAddTab?: () => void;
  onSelectTab?: (tabId?: string) => void;
  activeTabId?: string;
  onEdit?: () => void;
  onRemove?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
  isDragging?: boolean;
  children: React.ReactNode;
  className?: string;
}

interface ErrorBoundaryProps {
  children?: React.ReactNode;
  fallbackTitle?: string;
  errorTitle?: string;
  errorDesc?: string;
  retryText?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class WidgetErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("WidgetErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center min-h-[160px] rounded-xl border border-rose-200 dark:border-rose-950/60 bg-rose-50/50 dark:bg-rose-950/20 text-foreground">
          <AlertTriangle className="h-5 w-5 text-rose-500 mb-2" />
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
            {this.props.fallbackTitle || this.props.errorTitle || "Unable to display this widget"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
            {this.props.errorDesc || "An unexpected error occurred while rendering this metric."}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-3 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            {this.props.retryText || "Retry"}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function WidgetContainer({
  widget,
  title,
  subtitle,
  isEditing = false,
  onResizeCustom,
  onToggleRowBreak,
  onSplitInHalf,
  onAddTab,
  onSelectTab,
  activeTabId,
  onEdit,
  onRemove,
  onMoveLeft,
  onMoveRight,
  canMoveLeft = false,
  canMoveRight = false,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver = false,
  isDragging = false,
  children,
  className,
}: WidgetContainerProps) {
  const { t } = useLanguage();
  const capability = getMetricCapability(widget.metricId);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [showDimensionPicker, setShowDimensionPicker] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);

  const baseHeight =
    widget.options?.customHeightPx ||
    (widget.options?.customHeight === "compact"
      ? 220
      : widget.options?.customHeight === "tall"
      ? 440
      : 300);

  const baseWidth =
    widget.options?.customWidthPercent ||
    (widget.size === "sm" ? 25 : widget.size === "md" ? 50 : widget.size === "lg" ? 75 : 100);

  const [liveWidthPercent, setLiveWidthPercent] = React.useState<number | null>(null);
  const [liveHeightPx, setLiveHeightPx] = React.useState<number | null>(null);

  const currentWidth = liveWidthPercent ?? baseWidth;
  const currentHeight = liveHeightPx ?? baseHeight;

  // Exact fluid width calculation: calc(W% - (1 - W / 100) * 1.25rem)
  const fluidWidthStyle = React.useMemo(() => {
    if (widget.options?.rowBreak || currentWidth >= 100) {
      return "100%";
    }
    const gapAdj = (1 - currentWidth / 100) * 1.25;
    return `calc(${currentWidth}% - ${gapAdj.toFixed(4)}rem)`;
  }, [currentWidth, widget.options?.rowBreak]);

  if (widget.visualization === "pulse_kpis" && !isEditing) {
    return (
      <div
        ref={containerRef}
        style={{
          width: "100%",
          flex: "0 0 100%",
          maxWidth: "100%",
        }}
        className={cn("w-full", className)}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      draggable={isEditing && !isResizing}
      onDragStart={isEditing && !isResizing ? onDragStart : undefined}
      onDragOver={isEditing && !isResizing ? onDragOver : undefined}
      onDrop={isEditing && !isResizing ? onDrop : undefined}
      onDragEnd={isEditing && !isResizing ? onDragEnd : undefined}
      style={{
        width: fluidWidthStyle,
        flex: `0 0 ${fluidWidthStyle}`,
        minHeight: `${currentHeight}px`,
        maxWidth: "100%",
      }}
      className={cn(
        "group relative flex flex-col rounded-2xl w-full sm:w-auto",
        isResizing
          ? "transition-none select-none shadow-xl ring-2 ring-blue-500/80 border-blue-500 z-30"
          : "transition-all duration-150 bg-card text-card-foreground shadow-xs",
        isEditing && !isResizing && "ring-1 ring-blue-500/40 border-blue-500/30 hover:shadow-md cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 scale-[0.99] border-dashed border-blue-400 dark:border-blue-500",
        isDragOver && "ring-2 ring-blue-500/80 border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 shadow-lg scale-[1.01]",
        className
      )}
    >
      {/* Live Dimension Floating Pill while dragging resize */}
      {(liveHeightPx !== null || liveWidthPercent !== null) && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-40 bg-blue-600 text-white text-[11px] font-mono font-bold px-3 py-1 rounded-full shadow-lg pointer-events-none flex items-center gap-1.5 animate-in fade-in">
          <span>{Math.round(currentWidth * 10) / 10}%</span>
          <span className="opacity-60">×</span>
          <span>{currentHeight}px</span>
        </div>
      )}

      {/* Widget Header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2 border-b border-border-subtle">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
              {title ||
                widget.title ||
                (capability?.labelKey ? resolveTranslationKey(t, capability.labelKey) : undefined) ||
                capability?.id ||
                "Widget"}
            </h3>
          </div>
          {subtitle && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>

        {/* Edit Mode Toolbar Controls (Clean & minimal: Pencil to configure + Trash to remove) */}
        {isEditing && (
          <div
            draggable={false}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1 shrink-0 bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 text-xs"
          >
            {/* Screen Reader Accessible Navigation */}
            <button
              type="button"
              disabled={!canMoveLeft}
              onClick={onMoveLeft}
              aria-label={t.widgets.moveLeft}
              className="sr-only"
            >
              {t.widgets.moveLeft}
            </button>
            <button
              type="button"
              disabled={!canMoveRight}
              onClick={onMoveRight}
              aria-label={t.widgets.moveRight}
              className="sr-only"
            >
              {t.widgets.moveRight}
            </button>

            {/* Configure / Edit (Lápis) */}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label={t.widgets.configureWidget}
                title={t.widgets.configureWidget}
                className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-zinc-700/60 transition-colors cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Remove */}
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                aria-label={t.widgets.removeWidget}
                title={t.widgets.removeWidget}
                className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-zinc-700/60 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs Bar (When widget has grouped tabs) */}
      {widget.options?.tabs && widget.options.tabs.length > 0 && (
        <div className="flex items-center gap-1.5 px-5 pt-1.5 pb-2 border-b border-zinc-100 dark:border-white/[0.04] overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => onSelectTab?.(undefined)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer",
              !activeTabId
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            )}
          >
            {title || widget.title || "Principal"}
          </button>
          {widget.options.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab?.(tab.id)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer",
                activeTabId === tab.id
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
          {isEditing && onAddTab && (
            <button
              type="button"
              onClick={onAddTab}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-400 px-2 py-0.5 rounded cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              {t.widgets.addTab}
            </button>
          )}
        </div>
      )}

      {/* Fluid Resize Handle: Right Edge (Width) */}
      {isEditing && (
        <div
          draggable={false}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsResizing(true);
            const startX = e.clientX;
            const gridContainer = containerRef.current?.closest("[data-grid-container]") as HTMLElement | null;
            const totalGridWidth = gridContainer?.clientWidth || window.innerWidth;
            const startWidthPx = containerRef.current?.getBoundingClientRect().width || (currentWidth / 100) * totalGridWidth;

            let finalW = currentWidth;

            const handleMouseMove = (moveEvt: MouseEvent) => {
              moveEvt.preventDefault();
              const deltaX = moveEvt.clientX - startX;
              const newWidthPx = Math.max(220, Math.min(totalGridWidth, startWidthPx + deltaX));
              const newPercent = (newWidthPx / totalGridWidth) * 100;
              finalW = Math.max(15, Math.min(100, Math.round(newPercent * 10) / 10));

              if (containerRef.current) {
                containerRef.current.style.transition = "none";
                const gapAdj = (1 - finalW / 100) * 1.25;
                const wStr = finalW >= 100 ? "100%" : `calc(${finalW}% - ${gapAdj.toFixed(4)}rem)`;
                containerRef.current.style.width = wStr;
                containerRef.current.style.flex = `0 0 ${wStr}`;
              }
              setLiveWidthPercent(finalW);
            };

            const handleMouseUp = () => {
              window.removeEventListener("mousemove", handleMouseMove);
              window.removeEventListener("mouseup", handleMouseUp);
              setIsResizing(false);
              if (containerRef.current) {
                containerRef.current.style.transition = "";
              }
              setLiveWidthPercent(null);
              onResizeCustom?.(finalW, currentHeight);
            };

            window.addEventListener("mousemove", handleMouseMove, { passive: false });
            window.addEventListener("mouseup", handleMouseUp);
          }}
          title="Arrastar borda direita para redimensionar largura livremente"
          className="absolute -right-1.5 top-6 bottom-6 w-3 cursor-ew-resize rounded-full bg-transparent hover:bg-blue-500/30 active:bg-blue-500/60 transition-all z-20 flex items-center justify-center group/resize"
        >
          <div className="w-1 h-8 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover/resize:bg-blue-500 transition-colors" />
        </div>
      )}

      {/* Fluid Resize Handle: Bottom Edge (Height) */}
      {isEditing && (
        <div
          draggable={false}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsResizing(true);
            const startY = e.clientY;
            const startHeightPx = containerRef.current?.getBoundingClientRect().height || currentHeight;

            let finalH = currentHeight;

            const handleMouseMove = (moveEvt: MouseEvent) => {
              moveEvt.preventDefault();
              const deltaY = moveEvt.clientY - startY;
              finalH = Math.round(Math.max(160, Math.min(1200, startHeightPx + deltaY)));

              if (containerRef.current) {
                containerRef.current.style.transition = "none";
                containerRef.current.style.minHeight = `${finalH}px`;
              }
              setLiveHeightPx(finalH);
            };

            const handleMouseUp = () => {
              window.removeEventListener("mousemove", handleMouseMove);
              window.removeEventListener("mouseup", handleMouseUp);
              setIsResizing(false);
              if (containerRef.current) {
                containerRef.current.style.transition = "";
              }
              setLiveHeightPx(null);
              onResizeCustom?.(currentWidth, finalH);
            };

            window.addEventListener("mousemove", handleMouseMove, { passive: false });
            window.addEventListener("mouseup", handleMouseUp);
          }}
          title="Arrastar borda inferior para redimensionar altura livremente"
          className="absolute left-6 right-6 -bottom-1.5 h-3 cursor-ns-resize rounded-full bg-transparent hover:bg-blue-500/30 active:bg-blue-500/60 transition-all z-20 flex items-center justify-center group/resize-h"
        >
          <div className="h-1 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover/resize-h:bg-blue-500 transition-colors" />
        </div>
      )}

      {/* Fluid Resize Handle: Bottom-Right Corner (Both Width & Height) */}
      {isEditing && (
        <div
          draggable={false}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsResizing(true);
            const startX = e.clientX;
            const startY = e.clientY;
            const gridContainer = containerRef.current?.closest("[data-grid-container]") as HTMLElement | null;
            const totalGridWidth = gridContainer?.clientWidth || window.innerWidth;
            const startWidthPx = containerRef.current?.getBoundingClientRect().width || (currentWidth / 100) * totalGridWidth;
            const startHeightPx = containerRef.current?.getBoundingClientRect().height || currentHeight;

            let finalW = currentWidth;
            let finalH = currentHeight;

            const handleMouseMove = (moveEvt: MouseEvent) => {
              moveEvt.preventDefault();
              const deltaX = moveEvt.clientX - startX;
              const deltaY = moveEvt.clientY - startY;

              const newWidthPx = Math.max(220, Math.min(totalGridWidth, startWidthPx + deltaX));
              const newPercent = (newWidthPx / totalGridWidth) * 100;
              finalW = Math.max(15, Math.min(100, Math.round(newPercent * 10) / 10));
              finalH = Math.round(Math.max(160, Math.min(1200, startHeightPx + deltaY)));

              if (containerRef.current) {
                containerRef.current.style.transition = "none";
                const gapAdj = (1 - finalW / 100) * 1.25;
                const wStr = finalW >= 100 ? "100%" : `calc(${finalW}% - ${gapAdj.toFixed(4)}rem)`;
                containerRef.current.style.width = wStr;
                containerRef.current.style.flex = `0 0 ${wStr}`;
                containerRef.current.style.minHeight = `${finalH}px`;
              }
              setLiveWidthPercent(finalW);
              setLiveHeightPx(finalH);
            };

            const handleMouseUp = () => {
              window.removeEventListener("mousemove", handleMouseMove);
              window.removeEventListener("mouseup", handleMouseUp);
              setIsResizing(false);
              if (containerRef.current) {
                containerRef.current.style.transition = "";
              }
              setLiveWidthPercent(null);
              setLiveHeightPx(null);
              onResizeCustom?.(finalW, finalH);
            };

            window.addEventListener("mousemove", handleMouseMove, { passive: false });
            window.addEventListener("mouseup", handleMouseUp);
          }}
          title="Arrastar canto para redimensionar largura e altura"
          className="absolute -right-1 -bottom-1 w-5 h-5 cursor-nwse-resize z-20 flex items-center justify-center text-zinc-400 hover:text-blue-500 transition-colors"
        >
          <svg className="w-3 h-3 opacity-60 hover:opacity-100" viewBox="0 0 6 6" fill="none">
            <path
              d="M5 1L1 5M5 3L3 5M5 5H5.01"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      {/* Widget Body Wrapped in Error Boundary */}
      <div className="flex-1 p-5">
        <WidgetErrorBoundary
          fallbackTitle={title || widget.title}
          errorTitle={t.widgets.errorTitle}
          errorDesc={t.widgets.errorDesc}
          retryText={t.widgets.retry}
        >
          {children}
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}
