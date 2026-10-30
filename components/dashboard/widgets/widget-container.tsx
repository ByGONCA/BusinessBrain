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
        <div className="flex flex-col items-center justify-center p-6 text-center min-h-[160px] rounded-xl border border-rose-200 dark:border-rose-950/60 bg-rose-50/50 dark:bg-rose-950/20 text-zinc-900 dark:text-zinc-100">
          <AlertTriangle className="h-5 w-5 text-rose-500 mb-2" />
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
            {this.props.fallbackTitle || this.props.errorTitle || "Unable to display this widget"}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs">
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

  const baseOffset = widget.options?.offsetXPercent || 0;
  const align = widget.options?.align || "left";

  const [liveWidthPercent, setLiveWidthPercent] = React.useState<number | null>(null);
  const [liveHeightPx, setLiveHeightPx] = React.useState<number | null>(null);
  const [liveOffsetX, setLiveOffsetX] = React.useState<number | null>(null);

  const currentWidth = liveWidthPercent ?? baseWidth;
  const currentHeight = liveHeightPx ?? baseHeight;
  const currentOffset = liveOffsetX ?? baseOffset;

  // Margin styles for horizontal positioning
  const marginStyle = React.useMemo(() => {
    if (align === "center") {
      return { marginLeft: "auto", marginRight: "auto" };
    }
    if (align === "right") {
      return { marginLeft: "auto", marginRight: "0" };
    }
    if (currentOffset > 0) {
      return { marginLeft: `${currentOffset}%`, marginRight: "auto" };
    }
    return {};
  }, [align, currentOffset]);

  return (
    <div
      ref={containerRef}
      draggable={isEditing && !isResizing}
      onDragStart={isEditing && !isResizing ? onDragStart : undefined}
      onDragOver={isEditing && !isResizing ? onDragOver : undefined}
      onDrop={isEditing && !isResizing ? onDrop : undefined}
      onDragEnd={isEditing && !isResizing ? onDragEnd : undefined}
      style={{
        minHeight: `${currentHeight}px`,
        width: widget.options?.customWidthPercent || liveWidthPercent ? `${currentWidth}%` : undefined,
        maxWidth: "100%",
        ...marginStyle,
      }}
      className={cn(
        "group relative flex flex-col rounded-2xl border",
        isResizing
          ? "transition-none select-none shadow-xl ring-2 ring-blue-500/80 border-blue-500"
          : "transition-all duration-150 border-zinc-200/90 dark:border-white/[0.08] bg-white dark:bg-[#121316] shadow-xs",
        isEditing && !isResizing && "ring-1 ring-blue-500/40 border-blue-500/30 hover:shadow-md cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 scale-[0.99] border-dashed border-blue-400 dark:border-blue-500",
        isDragOver && "ring-2 ring-blue-500/80 border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 shadow-lg scale-[1.01]",
        className
      )}
    >
      {/* Live Dimension Floating Pill while dragging resize */}
      {(liveHeightPx !== null || liveWidthPercent !== null || liveOffsetX !== null) && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-40 bg-blue-600 text-white text-[11px] font-mono font-bold px-3 py-1 rounded-full shadow-lg pointer-events-none flex items-center gap-2 animate-in fade-in">
          {liveOffsetX !== null && <span>Pos: {currentOffset}%</span>}
          {(liveWidthPercent !== null || liveHeightPx !== null) && (
            <>
              <span>{currentWidth}%</span>
              <span className="opacity-60">×</span>
              <span>{currentHeight}px</span>
            </>
          )}
        </div>
      )}

      {/* Widget Header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2 border-b border-zinc-100 dark:border-white/[0.04]">
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

        {/* Edit Mode Toolbar Controls (Drag-immune controls, NO ARROWS) */}
        {isEditing && (
          <div
            draggable={false}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1 shrink-0 bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 text-xs"
          >
            {/* Screen Reader Accessible Navigation (Visually hidden - no visible arrow clutter) */}
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

            {/* Split in Half (50/50 Dual Column) */}
            {onSplitInHalf && (widget.size === "full" || widget.size === "lg" || currentWidth >= 60) && (
              <button
                type="button"
                onClick={onSplitInHalf}
                title={t.widgets.splitInHalf}
                aria-label={t.widgets.splitInHalf}
                className="p-1 rounded text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                <Columns2 className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Force Row Break (Below vs Side-by-Side) */}
            {onToggleRowBreak && (
              <button
                type="button"
                onClick={onToggleRowBreak}
                title={widget.options?.rowBreak ? t.widgets.sideBySide : t.widgets.forceRowBreak}
                aria-label={widget.options?.rowBreak ? t.widgets.sideBySide : t.widgets.forceRowBreak}
                className={cn(
                  "p-1 rounded transition-colors cursor-pointer",
                  widget.options?.rowBreak
                    ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                )}
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
              </button>
            )}

            {/* 100% Custom Dimension & Position Pill with Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDimensionPicker((prev) => !prev)}
                title="Dimensões e posição livre no ecrã"
                className="px-2 py-0.5 text-[10px] font-mono font-medium rounded text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-600 border border-zinc-200 dark:border-zinc-600 transition-colors cursor-pointer flex items-center gap-1"
              >
                <SlidersHorizontal className="h-2.5 w-2.5 text-blue-500" />
                <span>
                  {align === "center" ? "Centro" : align === "right" ? "Dir" : `${currentOffset > 0 ? `+${currentOffset}%` : "Esq"}`} • {currentWidth}% × {currentHeight}px
                </span>
              </button>

              {showDimensionPicker && (
                <div
                  draggable={false}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-2 z-50 w-72 p-3 bg-white dark:bg-[#16181D] border border-zinc-200 dark:border-white/[0.1] rounded-xl shadow-2xl space-y-3 text-xs animate-in fade-in"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.06] pb-2 font-semibold text-zinc-900 dark:text-white">
                    <span>Dimensões e Posição Livres</span>
                    <button
                      type="button"
                      onClick={() => setShowDimensionPicker(false)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Posição no Ecrã (Esquerda, Centro, Direita) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
                      <span>{t.widgets.horizontalPosition}</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {align === "center"
                          ? t.widgets.alignCenter
                          : align === "right"
                          ? t.widgets.alignRight
                          : currentOffset > 0
                          ? `Offset ${currentOffset}%`
                          : t.widgets.alignLeft}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => onResizeCustom?.(currentWidth, currentHeight, "left", 0)}
                        className={cn(
                          "py-1 px-1.5 rounded text-[10px] font-medium transition-colors cursor-pointer text-center truncate",
                          align === "left" && currentOffset === 0
                            ? "bg-blue-600 text-white font-bold"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        )}
                      >
                        {t.widgets.alignLeft}
                      </button>
                      <button
                        type="button"
                        onClick={() => onResizeCustom?.(currentWidth, currentHeight, "center", 0)}
                        className={cn(
                          "py-1 px-1.5 rounded text-[10px] font-medium transition-colors cursor-pointer text-center truncate",
                          align === "center"
                            ? "bg-blue-600 text-white font-bold"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        )}
                      >
                        {t.widgets.alignCenter}
                      </button>
                      <button
                        type="button"
                        onClick={() => onResizeCustom?.(currentWidth, currentHeight, "right", 0)}
                        className={cn(
                          "py-1 px-1.5 rounded text-[10px] font-medium transition-colors cursor-pointer text-center truncate",
                          align === "right"
                            ? "bg-blue-600 text-white font-bold"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        )}
                      >
                        {t.widgets.alignRight}
                      </button>
                    </div>

                    {/* Deslocamento Livre Horizontal (Offset %) */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span>{t.widgets.horizontalOffset}</span>
                        <span className="font-mono">{currentOffset}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(10, 100 - currentWidth)}
                        step={1}
                        value={currentOffset}
                        onChange={(e) =>
                          onResizeCustom?.(currentWidth, currentHeight, "left", Number(e.target.value))
                        }
                        className="w-full accent-blue-600 cursor-pointer h-1.5"
                      />
                      <div className="flex justify-between gap-1 pt-0.5">
                        {[0, 10, 20, 33, 50]
                          .filter((off) => off <= 100 - currentWidth)
                          .map((off) => (
                            <button
                              key={off}
                              type="button"
                              onClick={() => onResizeCustom?.(currentWidth, currentHeight, "left", off)}
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer",
                                currentOffset === off && align === "left"
                                  ? "bg-blue-600 text-white font-bold"
                                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                              )}
                            >
                              {off}%
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* Largura Slider & Presets */}
                  <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-white/[0.06]">
                    <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
                      <span>Largura</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {currentWidth}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={100}
                      step={1}
                      value={currentWidth}
                      onChange={(e) =>
                        onResizeCustom?.(Number(e.target.value), currentHeight, align, currentOffset)
                      }
                      className="w-full accent-blue-600 cursor-pointer h-1.5"
                    />
                    <div className="flex justify-between gap-1 pt-0.5">
                      {[25, 33, 50, 66, 75, 100].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => onResizeCustom?.(w, currentHeight, align, currentOffset)}
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer",
                            currentWidth === w
                              ? "bg-blue-600 text-white font-bold"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                          )}
                        >
                          {w}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Altura Slider & Presets */}
                  <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-white/[0.06]">
                    <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
                      <span>Altura</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {currentHeight}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={160}
                      max={900}
                      step={10}
                      value={currentHeight}
                      onChange={(e) =>
                        onResizeCustom?.(currentWidth, Number(e.target.value), align, currentOffset)
                      }
                      className="w-full accent-blue-600 cursor-pointer h-1.5"
                    />
                    <div className="flex justify-between gap-1 pt-0.5">
                      {[220, 300, 420, 560, 720].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => onResizeCustom?.(currentWidth, h, align, currentOffset)}
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer",
                            Math.abs(currentHeight - h) < 20
                              ? "bg-blue-600 text-white font-bold"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                          )}
                        >
                          {h}px
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Configure / Edit */}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label={t.widgets.configureWidget}
                title={t.widgets.configureWidget}
                className="p-1 rounded text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
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
                className="p-1 rounded text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
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

      {/* 100% Fluid Position Handle: Left Edge (Horizontal Offset) */}
      {isEditing && (
        <div
          draggable={false}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsResizing(true);
            const startX = e.clientX;
            const initialOffset = currentOffset;
            const gridContainer = containerRef.current?.closest("[data-grid-container]") as HTMLElement | null;
            const totalGridWidth = gridContainer?.clientWidth || window.innerWidth;

            let currentOff = initialOffset;

            const handleMouseMove = (moveEvt: MouseEvent) => {
              moveEvt.preventDefault();
              const deltaX = moveEvt.clientX - startX;
              const deltaPercent = (deltaX / totalGridWidth) * 100;
              const maxOffset = Math.max(0, 100 - currentWidth);
              currentOff = Math.round(Math.max(0, Math.min(maxOffset, initialOffset + deltaPercent)));

              if (containerRef.current) {
                containerRef.current.style.transition = "none";
                containerRef.current.style.marginLeft = `${currentOff}%`;
              }
              setLiveOffsetX(currentOff);
            };

            const handleMouseUp = () => {
              window.removeEventListener("mousemove", handleMouseMove);
              window.removeEventListener("mouseup", handleMouseUp);
              setIsResizing(false);
              if (containerRef.current) {
                containerRef.current.style.transition = "";
              }
              setLiveOffsetX(null);
              onResizeCustom?.(currentWidth, currentHeight, "left", currentOff);
            };

            window.addEventListener("mousemove", handleMouseMove, { passive: false });
            window.addEventListener("mouseup", handleMouseUp);
          }}
          title="Arrastar borda esquerda para mover posição livremente"
          className="absolute -left-1.5 top-6 bottom-6 w-3 cursor-ew-resize rounded-full bg-transparent hover:bg-blue-500/30 active:bg-blue-500/60 transition-all z-20 flex items-center justify-center group/resize-left"
        >
          <div className="w-1 h-8 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover/resize-left:bg-blue-500 transition-colors" />
        </div>
      )}

      {/* 100% Fluid Resize Handle: Right Edge (Width) */}
      {isEditing && (
        <div
          draggable={false}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsResizing(true);
            const startX = e.clientX;
            const initialWidth = currentWidth;
            const gridContainer = containerRef.current?.closest("[data-grid-container]") as HTMLElement | null;
            const totalGridWidth = gridContainer?.clientWidth || window.innerWidth;

            let currentW = initialWidth;

            const handleMouseMove = (moveEvt: MouseEvent) => {
              moveEvt.preventDefault();
              const deltaX = moveEvt.clientX - startX;
              const deltaPercent = (deltaX / totalGridWidth) * 100;
              const maxW = Math.max(20, 100 - currentOffset);
              currentW = Math.round(Math.max(20, Math.min(maxW, initialWidth + deltaPercent)));

              if (containerRef.current) {
                containerRef.current.style.transition = "none";
                containerRef.current.style.width = `${currentW}%`;
              }
              setLiveWidthPercent(currentW);
            };

            const handleMouseUp = () => {
              window.removeEventListener("mousemove", handleMouseMove);
              window.removeEventListener("mouseup", handleMouseUp);
              setIsResizing(false);
              if (containerRef.current) {
                containerRef.current.style.transition = "";
              }
              setLiveWidthPercent(null);
              onResizeCustom?.(currentW, currentHeight, align, currentOffset);
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

      {/* 100% Fluid Resize Handle: Bottom Edge (Height) */}
      {isEditing && (
        <div
          draggable={false}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsResizing(true);
            const startY = e.clientY;
            const initialHeight = currentHeight;

            let currentH = initialHeight;

            const handleMouseMove = (moveEvt: MouseEvent) => {
              moveEvt.preventDefault();
              const deltaY = moveEvt.clientY - startY;
              currentH = Math.round(Math.max(160, Math.min(1200, initialHeight + deltaY)));

              if (containerRef.current) {
                containerRef.current.style.transition = "none";
                containerRef.current.style.minHeight = `${currentH}px`;
              }
              setLiveHeightPx(currentH);
            };

            const handleMouseUp = () => {
              window.removeEventListener("mousemove", handleMouseMove);
              window.removeEventListener("mouseup", handleMouseUp);
              setIsResizing(false);
              if (containerRef.current) {
                containerRef.current.style.transition = "";
              }
              setLiveHeightPx(null);
              onResizeCustom?.(currentWidth, currentH, align, currentOffset);
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

      {/* 100% Fluid Resize Handle: Bottom-Right Corner (Both Width & Height) */}
      {isEditing && (
        <div
          draggable={false}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsResizing(true);
            const startX = e.clientX;
            const startY = e.clientY;
            const initialWidth = currentWidth;
            const initialHeight = currentHeight;
            const gridContainer = containerRef.current?.closest("[data-grid-container]") as HTMLElement | null;
            const totalGridWidth = gridContainer?.clientWidth || window.innerWidth;

            let currentW = initialWidth;
            let currentH = initialHeight;

            const handleMouseMove = (moveEvt: MouseEvent) => {
              moveEvt.preventDefault();
              const deltaX = moveEvt.clientX - startX;
              const deltaY = moveEvt.clientY - startY;
              const deltaPercent = (deltaX / totalGridWidth) * 100;
              const maxW = Math.max(20, 100 - currentOffset);
              currentW = Math.round(Math.max(20, Math.min(maxW, initialWidth + deltaPercent)));
              currentH = Math.round(Math.max(160, Math.min(1200, initialHeight + deltaY)));

              if (containerRef.current) {
                containerRef.current.style.transition = "none";
                containerRef.current.style.width = `${currentW}%`;
                containerRef.current.style.minHeight = `${currentH}px`;
              }
              setLiveWidthPercent(currentW);
              setLiveHeightPx(currentH);
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
              onResizeCustom?.(currentW, currentH, align, currentOffset);
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
