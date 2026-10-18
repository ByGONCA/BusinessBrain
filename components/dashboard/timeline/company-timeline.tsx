"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  CreditCard,
  Sparkles,
  ExternalLink,
  X,
} from "lucide-react";
import {
  TimelineEvent,
  TimelineCategory,
} from "@/lib/timeline/types";
import { cn } from "@/lib/utils";

interface CompanyTimelineProps {
  events: TimelineEvent[];
  organizationName: string;
}

const MIN_MS_PER_PIXEL = 4_000; // ~1 hour across 1000px
const MAX_MS_PER_PIXEL = 350_000_000; // ~11 years across 1000px
const DEFAULT_SPAN_DAYS = 90; // Default view span of ~3 months

const CATEGORY_CONFIG: Record<
  TimelineCategory,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    border: string;
    bg: string;
    text: string;
  }
> = {
  milestone: {
    label: "Milestone",
    icon: Building2,
    color: "bg-blue-500",
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
  },
  team: {
    label: "Equipa",
    icon: Users,
    color: "bg-emerald-500",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
  billing: {
    label: "Faturação",
    icon: CreditCard,
    color: "bg-amber-500",
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
  },
  work: {
    label: "Trabalho",
    icon: Sparkles,
    color: "bg-purple-500",
    border: "border-purple-500/40",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
  },
  memory: {
    label: "Memória",
    icon: Sparkles,
    color: "bg-indigo-500",
    border: "border-indigo-500/40",
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
  },
};

const STANDARD_INTERVALS_MS = [
  60_000, // 1m
  5 * 60_000, // 5m
  15 * 60_000, // 15m
  30 * 60_000, // 30m
  60 * 60_000, // 1h
  3 * 60 * 60_000, // 3h
  6 * 60 * 60_000, // 6h
  12 * 60 * 60_000, // 12h
  24 * 60 * 60_000, // 1d
  2 * 24 * 60 * 60_000, // 2d
  5 * 24 * 60 * 60_000, // 5d
  7 * 24 * 60 * 60_000, // 1w
  14 * 24 * 60 * 60_000, // 2w
  30 * 24 * 60 * 60_000, // 1mo (~30d)
  60 * 24 * 60 * 60_000, // 2mo
  90 * 24 * 60 * 60_000, // 3mo
  180 * 24 * 60 * 60_000, // 6mo
  365 * 24 * 60 * 60_000, // 1y
  2 * 365 * 24 * 60 * 60_000, // 2y
  5 * 365 * 24 * 60 * 60_000, // 5y
];

interface ViewState {
  viewStartTime: number; // ms at x = 0
  msPerPixel: number;
}

export function CompanyTimeline({ events, organizationName: _organizationName }: CompanyTimelineProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState<number>(1000);
  const [isMounted, setIsMounted] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState<TimelineEvent | null>(null);

  // Active view coordinates (continuous pan & zoom)
  const [viewState, setViewState] = React.useState<ViewState>(() => {
    const now = 1727636400000;
    const msPerPixel = (DEFAULT_SPAN_DAYS * 86_400_000) / 1000;
    return {
      viewStartTime: now - 500 * msPerPixel,
      msPerPixel,
    };
  });

  const isDraggingRef = React.useRef(false);
  const dragStartRef = React.useRef({ x: 0, viewStartTime: 0 });
  const viewStateRef = React.useRef(viewState);
  viewStateRef.current = viewState;

  // Measure container and center around Today
  React.useEffect(() => {
    setIsMounted(true);
    const container = containerRef.current;
    const initialWidth = container?.clientWidth || 1000;
    setContainerWidth(initialWidth);

    const now = Date.now();
    const initialMsPerPixel = (DEFAULT_SPAN_DAYS * 86_400_000) / initialWidth;
    setViewState({
      viewStartTime: now - initialWidth * 0.65 * initialMsPerPixel,
      msPerPixel: initialMsPerPixel,
    });

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    if (container) {
      observer.observe(container);
    }

    return () => observer.disconnect();
  }, []);

  // Non-passive wheel handler: Ctrl/Cmd + wheel or pinch to zoom in/out ("aproximar / desaproximar")
  // and horizontal swipe to navigate time
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Zoom with Ctrl/Cmd or trackpad pinch
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const cursorX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const current = viewStateRef.current;

        const cursorTime = current.viewStartTime + cursorX * current.msPerPixel;
        const zoomDelta = Math.exp(e.deltaY * 0.0018);
        const nextMsPerPixel = Math.max(
          MIN_MS_PER_PIXEL,
          Math.min(MAX_MS_PER_PIXEL, current.msPerPixel * zoomDelta)
        );
        const nextViewStartTime = cursorTime - cursorX * nextMsPerPixel;

        setViewState({
          viewStartTime: nextViewStartTime,
          msPerPixel: nextMsPerPixel,
        });
        return;
      }

      // Horizontal trackpad gesture
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        const current = viewStateRef.current;
        setViewState({
          ...current,
          viewStartTime: current.viewStartTime + e.deltaX * current.msPerPixel,
        });
        return;
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Pointer drag event handlers for direct timeline panning
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      viewStartTime: viewState.viewStartTime,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    setViewState((prev) => ({
      ...prev,
      viewStartTime: dragStartRef.current.viewStartTime - deltaX * prev.msPerPixel,
    }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Double click anywhere on timeline to zoom in (aproximar), Shift + double click to zoom out (desaproximar)
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cursorX = e.clientX - rect.left;
    const current = viewStateRef.current;
    const cursorTime = current.viewStartTime + cursorX * current.msPerPixel;
    const factor = e.shiftKey ? 1.6 : 0.6; // Shift+double-click zooms out; double-click zooms in
    const nextMsPerPixel = Math.max(
      MIN_MS_PER_PIXEL,
      Math.min(MAX_MS_PER_PIXEL, current.msPerPixel * factor)
    );
    setViewState({
      viewStartTime: cursorTime - cursorX * nextMsPerPixel,
      msPerPixel: nextMsPerPixel,
    });
  };

  // Close popover on ESC
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedEvent(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Dynamic tick calculation
  const visibleDuration = containerWidth * viewState.msPerPixel;
  const targetTicksCount = Math.max(4, Math.min(10, Math.floor(containerWidth / 150)));
  const targetIntervalMs = visibleDuration / targetTicksCount;

  let chosenIntervalMs = STANDARD_INTERVALS_MS[0];
  for (const interval of STANDARD_INTERVALS_MS) {
    chosenIntervalMs = interval;
    if (interval >= targetIntervalMs) break;
  }

  const ticks = React.useMemo(() => {
    const items: Array<{ x: number; label: string; subLabel?: string; time: number }> = [];
    const firstTickTime =
      Math.floor(viewState.viewStartTime / chosenIntervalMs) * chosenIntervalMs;
    const endTime = viewState.viewStartTime + visibleDuration + chosenIntervalMs;

    for (let t = firstTickTime; t <= endTime; t += chosenIntervalMs) {
      const x = (t - viewState.viewStartTime) / viewState.msPerPixel;
      if (x < -60 || x > containerWidth + 60) continue;

      const date = new Date(t);
      let label = "";
      let subLabel: string | undefined = undefined;

      if (chosenIntervalMs < 24 * 60 * 60_000) {
        label = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        subLabel = date.toLocaleDateString([], { month: "short", day: "numeric" });
      } else if (chosenIntervalMs < 30 * 24 * 60 * 60_000) {
        label = date.toLocaleDateString([], { month: "short", day: "numeric" });
        subLabel = date.toLocaleDateString([], { weekday: "short" });
      } else if (chosenIntervalMs < 365 * 24 * 60 * 60_000) {
        label = date.toLocaleDateString([], { month: "short", year: "numeric" });
      } else {
        label = date.getFullYear().toString();
      }

      items.push({ x, label, subLabel, time: t });
    }
    return items;
  }, [viewState.viewStartTime, viewState.msPerPixel, visibleDuration, chosenIntervalMs, containerWidth]);

  // Today indicator coordinates
  const now = isMounted ? Date.now() : 1727636400000;
  const todayX = (now - viewState.viewStartTime) / viewState.msPerPixel;
  const isTodayOnScreen = todayX >= 0 && todayX <= containerWidth;

  const sortedEvents = React.useMemo(() => {
    return [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [events]);

  return (
    <div className="relative w-full py-2 select-none">
      {/* Main Interactive Line Canvas - NO background, NO border box, NO buttons */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className={cn(
          "relative h-28 w-full overflow-visible touch-none transition-[cursor]",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        {/* The Clean Horizontal Timeline Line */}
        <div className="absolute left-0 right-0 top-[45%] -translate-y-1/2 h-0.5 bg-[#242427] pointer-events-none" />

        {/* Dynamic Tick Notches on the Line */}
        {ticks.map((tick, idx) => (
          <div
            key={idx}
            className="absolute top-[45%] -translate-x-1/2 pointer-events-none flex flex-col items-center"
            style={{ left: `${tick.x}px` }}
          >
            {/* Notch crossing the line */}
            <div className="h-2 w-px bg-[#3F3F46] -translate-y-1/2" />
            {/* Tick date label below the line */}
            <div className="flex items-baseline gap-1 mt-2">
              <span
                className="text-[10px] font-mono text-[#71717A]"
                suppressHydrationWarning
              >
                {tick.label}
              </span>
              {tick.subLabel && (
                <span
                  className="text-[9px] font-mono text-[#71717A]/70 hidden sm:inline"
                  suppressHydrationWarning
                >
                  {tick.subLabel}
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Today Marker Line & Badge */}
        {isMounted && isTodayOnScreen && (
          <div
            className="absolute top-0 bottom-3 pointer-events-none z-10 flex flex-col items-center"
            style={{ left: `${todayX}px` }}
          >
            <div className="flex items-center gap-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white shadow-md shadow-blue-500/40 uppercase">
              <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
              <span>Hoje</span>
            </div>
            <div className="w-0.5 flex-1 bg-gradient-to-b from-blue-500 to-blue-500/10 shadow-xs shadow-blue-400" />
          </div>
        )}

        {/* Milestone Events on the Line */}
        {sortedEvents.map((event, idx) => {
          const eventTime = new Date(event.timestamp).getTime();
          const x = (eventTime - viewState.viewStartTime) / viewState.msPerPixel;

          if (x < -80 || x > containerWidth + 80) return null;

          const isSelected = selectedEvent?.id === event.id;
          const cfg = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.milestone;
          const Icon = cfg.icon;

          // Alternating lanes: above line (-24px) or below line (+24px)
          const isAbove = idx % 2 === 0;
          const yOffset = isAbove ? -26 : 26;

          return (
            <div
              key={event.id}
              className="absolute z-20 transition-transform duration-75"
              style={{
                left: `${x}px`,
                top: `calc(45% + ${yOffset}px)`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {/* Connector stem to center line */}
              <div
                className={cn(
                  "absolute left-1/2 -translate-x-1/2 w-px bg-[#3F3F46] pointer-events-none transition-colors",
                  isAbove ? "top-full h-[14px]" : "bottom-full h-[14px]",
                  isSelected && "bg-blue-500"
                )}
              />

              {/* Event Bubble */}
              <button
                type="button"
                onClick={() => setSelectedEvent(event)}
                className={cn(
                  "group relative flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium shadow-sm transition-all focus:outline-none",
                  "bg-[#141415] text-[#F5F5F5]",
                  isSelected
                    ? "ring-2 ring-blue-500 scale-105 border-blue-500 z-30"
                    : "hover:scale-105 border-[#242427] hover:border-[#3F3F46]"
                )}
              >
                <div
                  className={cn(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-white",
                    cfg.color
                  )}
                >
                  <Icon className="h-2 w-2" />
                </div>
                <span className="truncate max-w-[120px] font-semibold text-[10px]">
                  {event.title}
                </span>

                {/* Hover Tooltip */}
                <div className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  <div className="whitespace-nowrap rounded-md border border-[#242427] bg-[#202023] px-2 py-1 text-[11px] text-[#F5F5F5] shadow-xl backdrop-blur-md">
                    <p className="font-semibold">{event.title}</p>
                    <p className="text-[9px] text-[#71717A] font-mono mt-0.5" suppressHydrationWarning>
                      {new Date(event.timestamp).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          );
        })}

        {/* Selected Event Popover */}
        {selectedEvent && (
          <div
            className="absolute top-1 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-sm rounded-xl border border-[#242427] bg-[#141415] p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 text-[#F5F5F5]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider border",
                      CATEGORY_CONFIG[selectedEvent.category].bg,
                      CATEGORY_CONFIG[selectedEvent.category].border,
                      CATEGORY_CONFIG[selectedEvent.category].text
                    )}
                  >
                    {CATEGORY_CONFIG[selectedEvent.category].label}
                  </span>
                  <span className="text-[10px] font-mono text-[#71717A]">
                    {new Date(selectedEvent.timestamp).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-[#F5F5F5] pt-0.5">
                  {selectedEvent.title}
                </h3>
                <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                  {selectedEvent.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                aria-label="Fechar"
                className="p-1 rounded-md text-[#71717A] hover:text-[#F5F5F5] hover:bg-[#1C1C1F] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {(selectedEvent.author || selectedEvent.link) && (
              <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-[#1C1C1F] text-[11px] text-[#71717A]">
                {selectedEvent.author && (
                  <span className="text-[10px] text-[#71717A]">
                    Por: <strong className="text-[#F5F5F5]">{selectedEvent.author.name}</strong>
                  </span>
                )}
                {selectedEvent.link && (
                  <Link
                    href={selectedEvent.link.href}
                    className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300"
                  >
                    <span>{selectedEvent.link.label}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
