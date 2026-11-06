"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  CreditCard,
  Scale,
  FolderKanban,
  BookOpen,
  Calendar,
  ExternalLink,
  X,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Clock,
  List,
  Layers,
  CheckCircle2,
  Flag,
  Filter,
} from "lucide-react";
import {
  TimelineEvent,
  TimelineCategory,
  TimelineTimeRange,
  TimelineViewMode,
  TimelineFilter,
} from "@/lib/timeline/types";
import { useLanguage, en } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface CompanyTimelineProps {
  events: TimelineEvent[];
  organizationName: string;
}

// Continuous Zoom Bounds (ms per pixel)
const MIN_MS_PER_PIXEL = 4_000; // Deep granular detail (hours across screen)
const MAX_MS_PER_PIXEL = 500_000_000; // Macro view (multi-year)

const CATEGORY_CONFIG: Record<
  TimelineCategory,
  {
    labelKey:
      | "categoryMilestone"
      | "categoryDecision"
      | "categoryProject"
      | "categoryTeam"
      | "categoryBilling"
      | "categoryWork"
      | "categoryMemory";
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    accentColor: string;
    pinBg: string;
    glowColor: string;
  }
> = {
  milestone: {
    labelKey: "categoryMilestone",
    icon: Flag,
    accentColor: "#F59E0B",
    pinBg: "bg-amber-400",
    glowColor: "rgba(245, 158, 11, 0.5)",
  },
  decision: {
    labelKey: "categoryDecision",
    icon: Scale,
    accentColor: "#A855F7",
    pinBg: "bg-purple-400",
    glowColor: "rgba(168, 85, 247, 0.5)",
  },
  project: {
    labelKey: "categoryProject",
    icon: FolderKanban,
    accentColor: "#38BDF8",
    pinBg: "bg-sky-400",
    glowColor: "rgba(56, 189, 248, 0.5)",
  },
  team: {
    labelKey: "categoryTeam",
    icon: Users,
    accentColor: "#10B981",
    pinBg: "bg-emerald-400",
    glowColor: "rgba(16, 185, 129, 0.5)",
  },
  billing: {
    labelKey: "categoryBilling",
    icon: CreditCard,
    accentColor: "#14B8A6",
    pinBg: "bg-teal-400",
    glowColor: "rgba(20, 184, 166, 0.5)",
  },
  work: {
    labelKey: "categoryWork",
    icon: CheckCircle2,
    accentColor: "#3B82F6",
    pinBg: "bg-blue-400",
    glowColor: "rgba(59, 130, 246, 0.5)",
  },
  memory: {
    labelKey: "categoryMemory",
    icon: BookOpen,
    accentColor: "#8B5CF6",
    pinBg: "bg-indigo-400",
    glowColor: "rgba(139, 92, 246, 0.5)",
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
  7 * 24 * 60 * 60_000, // 1w
  14 * 24 * 60 * 60_000, // 2w
  30 * 24 * 60 * 60_000, // 1mo
  90 * 24 * 60 * 60_000, // 1 quarter
  180 * 24 * 60 * 60_000, // 6mo
  365 * 24 * 60 * 60_000, // 1y
  2 * 365 * 24 * 60 * 60_000, // 2y
];

interface ViewState {
  viewStartTime: number;
  msPerPixel: number;
}

interface ClusteredTimelineNode {
  type: "single" | "cluster";
  id: string;
  x: number;
  lane: number;
  primaryEvent: TimelineEvent;
  events: TimelineEvent[];
}

export function CompanyTimeline({ events, organizationName: _organizationName }: CompanyTimelineProps) {
  const { t, locale } = useLanguage();
  const c = t?.companyTimeline || en.companyTimeline;
  const intlLocale =
    locale === "en" ? "en-US" : locale === "pt" ? "pt-PT" : locale === "es" ? "es-ES" : "fr-FR";

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState<number>(1000);
  const [isMounted, setIsMounted] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  // Interaction State
  const [viewMode, setViewMode] = React.useState<TimelineViewMode>("timeline");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<TimelineFilter>("all");
  const [selectedTimeRange, setSelectedTimeRange] = React.useState<TimelineTimeRange>("all");

  // Hover Popover State (Instant rich preview on hover)
  const [hoveredEvent, setHoveredEvent] = React.useState<TimelineEvent | null>(null);
  const [hoverPosition, setHoverPosition] = React.useState<{ x: number; y: number; isAbove: boolean } | null>(null);
  const [hoveredCluster, setHoveredCluster] = React.useState<{ events: TimelineEvent[]; x: number; y: number; isAbove: boolean } | null>(null);

  // Chronologically sorted events
  const chronologicalEvents = React.useMemo(() => {
    return [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [events]);

  // Baseline span & scale (frames 100% of company history across screen)
  const baselineScale = React.useMemo(() => {
    const width = containerWidth || 1000;
    if (chronologicalEvents.length === 0) {
      return {
        baseMsPerPixel: 10_000_000,
        centerTime: Date.now(),
      };
    }
    const timestamps = chronologicalEvents.map((e) => new Date(e.timestamp).getTime());
    const minEventTime = Math.min(...timestamps);
    const maxEventTime = Math.max(...timestamps);
    const rawSpan = maxEventTime - minEventTime;
    const span = rawSpan > 0 ? Math.max(7 * 86_400_000, rawSpan * 1.35) : 14 * 86_400_000;
    const baseMsPerPixel = Math.max(
      MIN_MS_PER_PIXEL,
      Math.min(MAX_MS_PER_PIXEL, span / width)
    );
    const centerTime = (minEventTime + maxEventTime) / 2;
    return { baseMsPerPixel, centerTime };
  }, [chronologicalEvents, containerWidth]);

  // Viewport Coordinates (Continuous Zoom & Pan)
  const [viewState, setViewState] = React.useState<ViewState>(() => {
    const width = 1000;
    const { baseMsPerPixel, centerTime } = baselineScale;
    return {
      viewStartTime: centerTime - (width / 2) * baseMsPerPixel,
      msPerPixel: baseMsPerPixel,
    };
  });

  const isDraggingRef = React.useRef(false);
  const dragStartRef = React.useRef({ x: 0, viewStartTime: 0 });
  const viewStateRef = React.useRef(viewState);
  viewStateRef.current = viewState;

  // Fluid Zoom Ratio: how deep the user has zoomed relative to baseline full history
  // zoomRatio <= 1.25 -> Macro / Baseline (Major strategic milestones only)
  // 1.25 < zoomRatio <= 2.8 -> Medium Zoom (Reveals named docs, meetings, updates)
  // zoomRatio > 2.8 -> Deep Zoom (Reveals all events: tasks, untitled drafts, audit logs)
  const zoomRatio = React.useMemo(() => {
    if (!baselineScale.baseMsPerPixel || !viewState.msPerPixel) return 1;
    return baselineScale.baseMsPerPixel / viewState.msPerPixel;
  }, [baselineScale.baseMsPerPixel, viewState.msPerPixel]);

  // Filtered Events with Organic Progressive Zoom Density
  const filteredEvents = React.useMemo(() => {
    const now = Date.now();
    let minTimestamp = 0;

    if (selectedTimeRange === "30d") {
      minTimestamp = now - 30 * 24 * 60 * 60_000;
    } else if (selectedTimeRange === "90d") {
      minTimestamp = now - 90 * 24 * 60 * 60_000;
    } else if (selectedTimeRange === "1y") {
      minTimestamp = now - 365 * 24 * 60 * 60_000;
    } else if (selectedTimeRange === "ytd") {
      minTimestamp = new Date(new Date().getFullYear(), 0, 1).getTime();
    }

    const hasSearch = searchQuery.trim().length > 0;
    const query = searchQuery.toLowerCase().trim();

    return chronologicalEvents.filter((ev) => {
      // Time range filter
      if (minTimestamp > 0 && new Date(ev.timestamp).getTime() < minTimestamp) {
        return false;
      }

      // Category filter
      if (selectedCategory !== "all" && ev.category !== selectedCategory) {
        return false;
      }

      // Organic Zoom Density (No arbitrary divisions):
      // - Far zoom (zoomRatio <= 1.3): Major milestones only.
      // - Medium zoom (1.3 < zoomRatio <= 2.8): Major + Normal initiatives/docs.
      // - Deep zoom (zoomRatio > 2.8): 100% of all events (tasks, untitled drafts, etc.).
      if (!hasSearch) {
        if (zoomRatio <= 1.3 && ev.importance !== "major") {
          return false;
        }
        if (zoomRatio > 1.3 && zoomRatio <= 2.8 && ev.importance === "minor") {
          return false;
        }
      }

      // Search query filter: if search is active, surfaces any matching event across all depths
      if (hasSearch) {
        const matchTitle = ev.title.toLowerCase().includes(query);
        const matchDesc = ev.description.toLowerCase().includes(query);
        const matchAuthor = ev.author?.name.toLowerCase().includes(query);
        const matchCategory = ev.category.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchAuthor && !matchCategory) {
          return false;
        }
      }

      return true;
    });
  }, [chronologicalEvents, selectedCategory, searchQuery, selectedTimeRange, zoomRatio]);

  // Action: Fit & Frame Events (Reset View using stable baseline)
  const handleResetView = React.useCallback(() => {
    const width = containerRef.current?.clientWidth || containerWidth || 1000;
    const { baseMsPerPixel, centerTime } = baselineScale;
    setViewState({
      viewStartTime: centerTime - (width / 2) * baseMsPerPixel,
      msPerPixel: baseMsPerPixel,
    });
  }, [baselineScale, containerWidth]);

  // Initial measure - strictly runs ONCE on mount, NEVER on zoom
  const hasInitializedRef = React.useRef(false);
  React.useEffect(() => {
    setIsMounted(true);
    const container = containerRef.current;
    if (container) {
      const width = container.clientWidth || 1000;
      setContainerWidth(width);
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        handleResetView();
      }

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            setContainerWidth(entry.contentRect.width);
          }
        }
      });
      observer.observe(container);
      return () => observer.disconnect();
    }
  }, [handleResetView]);

  // Action: Jump to Today
  const handleGoToToday = React.useCallback(() => {
    const width = containerWidth || 1000;
    const now = Date.now();
    setViewState((prev) => ({
      ...prev,
      viewStartTime: now - width * 0.7 * prev.msPerPixel,
    }));
  }, [containerWidth]);

  // Action: Jump to Earliest Milestone
  const handleGoToEarliest = React.useCallback(() => {
    if (chronologicalEvents.length === 0) return;
    const width = containerWidth || 1000;
    const earliestTime = new Date(chronologicalEvents[0].timestamp).getTime();
    setViewState((prev) => ({
      ...prev,
      viewStartTime: earliestTime - width * 0.15 * prev.msPerPixel,
    }));
  }, [chronologicalEvents, containerWidth]);

  // Action: Step Zoom In / Zoom Out
  const handleStepZoom = React.useCallback(
    (factor: number) => {
      const width = containerWidth || 1000;
      const current = viewStateRef.current;
      const centerTime = current.viewStartTime + (width / 2) * current.msPerPixel;
      const nextMsPerPixel = Math.max(
        MIN_MS_PER_PIXEL,
        Math.min(MAX_MS_PER_PIXEL, current.msPerPixel * factor)
      );

      setViewState({
        viewStartTime: centerTime - (width / 2) * nextMsPerPixel,
        msPerPixel: nextMsPerPixel,
      });
    },
    [containerWidth]
  );

  // Action: Zoom directly into a cluster of events
  const handleZoomIntoCluster = React.useCallback(
    (clusterEvents: TimelineEvent[]) => {
      if (clusterEvents.length === 0) return;
      const width = containerWidth || 1000;
      const timestamps = clusterEvents.map((e) => new Date(e.timestamp).getTime());
      const minTime = Math.min(...timestamps);
      const maxTime = Math.max(...timestamps);
      const span = Math.max(86_400_000 * 2, (maxTime - minTime) * 2.2);
      const targetMsPerPixel = Math.max(
        MIN_MS_PER_PIXEL,
        Math.min(viewStateRef.current.msPerPixel * 0.5, span / width)
      );
      const centerTime = (minTime + maxTime) / 2;

      setViewState({
        viewStartTime: centerTime - (width / 2) * targetMsPerPixel,
        msPerPixel: targetMsPerPixel,
      });
      setHoveredCluster(null);
    },
    [containerWidth]
  );

  // Smooth continuous zoom on wheel, and horizontal pan
  // Protected against zoom-out resets
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      const isZoomModifier = e.ctrlKey || e.metaKey;

      if (isZoomModifier) {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const cursorX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const current = viewStateRef.current;
        const cursorTime = current.viewStartTime + cursorX * current.msPerPixel;
        const zoomDelta = Math.exp(e.deltaY * 0.002);
        const nextMsPerPixel = Math.max(
          MIN_MS_PER_PIXEL,
          Math.min(MAX_MS_PER_PIXEL, current.msPerPixel * zoomDelta)
        );

        if (nextMsPerPixel !== current.msPerPixel) {
          setViewState({
            viewStartTime: cursorTime - cursorX * nextMsPerPixel,
            msPerPixel: nextMsPerPixel,
          });
        }
        return;
      }

      // Horizontal trackpad swipe or Shift + Wheel
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        const current = viewStateRef.current;
        const delta = e.shiftKey ? e.deltaY : e.deltaX;
        setViewState({
          ...current,
          viewStartTime: current.viewStartTime + delta * current.msPerPixel,
        });
        return;
      }

      // Standard vertical wheel over the canvas zooms smoothly without jitter
      if (Math.abs(e.deltaY) > 8) {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const cursorX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const current = viewStateRef.current;
        const cursorTime = current.viewStartTime + cursorX * current.msPerPixel;
        const factor = e.deltaY > 0 ? 1.12 : 0.89;
        const nextMsPerPixel = Math.max(
          MIN_MS_PER_PIXEL,
          Math.min(MAX_MS_PER_PIXEL, current.msPerPixel * factor)
        );

        if (nextMsPerPixel !== current.msPerPixel) {
          setViewState({
            viewStartTime: cursorTime - cursorX * nextMsPerPixel,
            msPerPixel: nextMsPerPixel,
          });
        }
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Pointer drag event handlers for direct timeline horizontal panning
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

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setHoveredEvent(null);
        setHoverPosition(null);
        setHoveredCluster(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Dynamic Time Axis Notches & Labels
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
      if (x < -80 || x > containerWidth + 80) continue;

      const date = new Date(t);
      let label = "";
      let subLabel: string | undefined = undefined;

      if (chosenIntervalMs < 24 * 60 * 60_000) {
        label = date.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" });
        subLabel = date.toLocaleDateString(intlLocale, { month: "short", day: "numeric" });
      } else if (chosenIntervalMs < 30 * 24 * 60 * 60_000) {
        label = date.toLocaleDateString(intlLocale, { month: "short", day: "numeric" });
        subLabel = date.toLocaleDateString(intlLocale, { weekday: "short" });
      } else if (chosenIntervalMs < 365 * 24 * 60 * 60_000) {
        label = date.toLocaleDateString(intlLocale, { month: "short", year: "numeric" });
      } else {
        label = date.getFullYear().toString();
      }

      items.push({ x, label, subLabel, time: t });
    }
    return items;
  }, [
    viewState.viewStartTime,
    viewState.msPerPixel,
    visibleDuration,
    chosenIntervalMs,
    containerWidth,
    intlLocale,
  ]);

  // Today marker coordinates
  const now = isMounted ? Date.now() : 1727636400000;
  const todayX = (now - viewState.viewStartTime) / viewState.msPerPixel;
  const isTodayOnScreen = todayX >= 0 && todayX <= containerWidth;

  // Smart Clustering and 4-Lane Staggered Distribution
  // Dynamically relaxes collision thresholds as the user zooms in
  const timelineNodes: ClusteredTimelineNode[] = React.useMemo(() => {
    const nodes: ClusteredTimelineNode[] = [];
    const collisionThreshold = zoomRatio <= 1.3 ? 48 : zoomRatio <= 2.8 ? 26 : 0;

    let laneIndex = 0;
    const sorted = [...filteredEvents].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let i = 0;
    while (i < sorted.length) {
      const current = sorted[i];
      const currentTime = new Date(current.timestamp).getTime();
      const currentX = (currentTime - viewState.viewStartTime) / viewState.msPerPixel;

      // In deep zoom, or if event is a major milestone, it always stands alone
      if (collisionThreshold === 0 || current.importance === "major") {
        nodes.push({
          type: "single",
          id: current.id,
          x: currentX,
          lane: laneIndex % 4,
          primaryEvent: current,
          events: [current],
        });
        laneIndex++;
        i++;
        continue;
      }

      // Check if following events are within collision distance
      const clustered: TimelineEvent[] = [current];
      let j = i + 1;
      while (j < sorted.length) {
        const next = sorted[j];
        if (next.importance === "major") break;

        const nextTime = new Date(next.timestamp).getTime();
        const nextX = (nextTime - viewState.viewStartTime) / viewState.msPerPixel;

        if (Math.abs(nextX - currentX) <= collisionThreshold) {
          clustered.push(next);
          j++;
        } else {
          break;
        }
      }

      if (clustered.length > 1) {
        nodes.push({
          type: "cluster",
          id: `cluster-${current.id}-${clustered.length}`,
          x: currentX,
          lane: laneIndex % 4,
          primaryEvent: current,
          events: clustered,
        });
      } else {
        nodes.push({
          type: "single",
          id: current.id,
          x: currentX,
          lane: laneIndex % 4,
          primaryEvent: current,
          events: [current],
        });
      }

      laneIndex++;
      i = j;
    }

    return nodes;
  }, [filteredEvents, viewState.viewStartTime, viewState.msPerPixel, zoomRatio]);

  // Convert lane index (0, 1, 2, 3) to staggered y offset (-120, +70, -55, +130)
  // Balanced above and below the central horizontal rail with optimal vertical headroom
  const getLaneOffset = (lane: number) => {
    switch (lane) {
      case 0:
        return -120; // Upper outer
      case 1:
        return 70; // Lower inner
      case 2:
        return -55; // Upper inner
      case 3:
      default:
        return 130; // Lower outer
    }
  };

  return (
    <div className="relative w-full space-y-4 select-none">
      {/* Integrated Controls Bar (Seamlessly on background, no card box, no divisions) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        {/* Left: Search, Category & Time Range Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Real-time search */}
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={c.searchPlaceholder}
              className="h-8 w-44 sm:w-56 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] pl-8 pr-7 text-xs text-white placeholder-zinc-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label={c.close}
                className="absolute right-2 text-zinc-500 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Category Dropdown Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as TimelineFilter)}
            className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] px-2.5 text-xs text-zinc-300 hover:text-white focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
          >
            <option value="all" className="bg-[#121316] text-white">{c.allCategories}</option>
            <option value="milestone" className="bg-[#121316] text-white">{c.categoryMilestone}</option>
            <option value="decision" className="bg-[#121316] text-white">{c.categoryDecision}</option>
            <option value="project" className="bg-[#121316] text-white">{c.categoryProject}</option>
            <option value="team" className="bg-[#121316] text-white">{c.categoryTeam}</option>
            <option value="billing" className="bg-[#121316] text-white">{c.categoryBilling}</option>
            <option value="work" className="bg-[#121316] text-white">{c.categoryWork}</option>
            <option value="memory" className="bg-[#121316] text-white">{c.categoryMemory}</option>
          </select>

          {/* Time Range Filter */}
          <div className="relative flex items-center">
            <Filter className="absolute left-2 h-3 w-3 text-zinc-500 pointer-events-none" />
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as TimelineTimeRange)}
              className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] pl-6 pr-2.5 text-xs text-zinc-300 hover:text-white focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
            >
              <option value="all" className="bg-[#121316] text-white">{c.timeRangeAll}</option>
              <option value="30d" className="bg-[#121316] text-white">{c.timeRange30d}</option>
              <option value="90d" className="bg-[#121316] text-white">{c.timeRange90d}</option>
              <option value="ytd" className="bg-[#121316] text-white">{c.timeRangeYearToDate}</option>
              <option value="1y" className="bg-[#121316] text-white">{c.timeRange1y}</option>
            </select>
          </div>

          {/* Total 100% History Count Label */}
          <span className="text-[11px] font-mono text-zinc-400 hidden xl:inline ml-1">
            {filteredEvents.length} {c.eventsFound} ({events.length} total)
          </span>
        </div>

        {/* Right: Zoom In/Out, Reset Frame, Earliest, Today & View Switcher */}
        <div className="flex items-center gap-1.5">
          {/* Zoom In & Out */}
          <div className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.02]">
            <button
              type="button"
              onClick={() => handleStepZoom(1.35)}
              title={c.zoomOut}
              className="p-1.5 text-zinc-400 hover:text-white transition-colors border-r border-white/[0.06]"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleStepZoom(0.7)}
              title={c.zoomIn}
              className="p-1.5 text-zinc-400 hover:text-white transition-colors"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Reset Frame */}
          <button
            type="button"
            onClick={handleResetView}
            title={c.resetView}
            className="h-8 px-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.04] transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden sm:inline">{c.resetView}</span>
          </button>

          {/* Earliest Milestone */}
          <button
            type="button"
            onClick={handleGoToEarliest}
            title={c.jumpToStart}
            className="h-8 px-2 rounded-lg border border-white/[0.08] bg-white/[0.02] text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors hidden md:flex items-center gap-1"
          >
            <Flag className="h-3 w-3" />
          </button>

          {/* Today Button */}
          <button
            type="button"
            onClick={handleGoToToday}
            title={c.today}
            className="h-8 px-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center gap-1.5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span>{c.today}</span>
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5 ml-1">
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              title={c.viewTimeline}
              className={cn(
                "p-1.5 rounded-md transition-all",
                viewMode === "timeline"
                  ? "bg-white/[0.1] text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              title={c.viewList}
              className={cn(
                "p-1.5 rounded-md transition-all",
                viewMode === "list"
                  ? "bg-white/[0.1] text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === "timeline" ? (
        /* HORIZONTAL TIMELINE CANVAS (Integrated directly on page, fluid continuous density) */
        <div className="relative w-full select-none">
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={cn(
              "relative h-[560px] sm:h-[600px] w-full overflow-hidden touch-none transition-[cursor]",
              isDragging ? "cursor-grabbing" : "cursor-grab"
            )}
          >
            {/* Ambient Background Grid Pattern with smooth vertical fade to eliminate black borders */}
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none [mask-image:linear-gradient(to_bottom,transparent_0%,black_8%,black_92%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_8%,black_92%,transparent_100%)]" />

            {/* Central Timeline Rail Line (Lowered to 54% to provide ample upper headroom) */}
            <div className="absolute left-0 right-0 top-[54%] -translate-y-1/2 h-[1.5px] bg-white/[0.14] pointer-events-none" />

            {/* Dynamic Time Axis Notches & Labels */}
            {ticks.map((tick, idx) => (
              <div
                key={idx}
                className="absolute top-[54%] -translate-x-1/2 pointer-events-none flex flex-col items-center"
                style={{ left: `${tick.x}px` }}
              >
                {/* Tick Notch */}
                <div className="h-3 w-px bg-white/30 -translate-y-1/2" />
                {/* Date Label Below Rail */}
                <div className="flex items-baseline gap-1 mt-3">
                  <span
                    className="text-[11px] font-mono font-medium text-zinc-400 tracking-tight"
                    suppressHydrationWarning
                  >
                    {tick.label}
                  </span>
                  {tick.subLabel && (
                    <span
                      className="text-[9px] font-mono text-zinc-400 hidden sm:inline"
                      suppressHydrationWarning
                    >
                      {tick.subLabel}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* "Today" Refined Anchor on Central Rail (Unobtrusive, does not slice through cards) */}
            {isMounted && isTodayOnScreen && (
              <div
                className="absolute top-[54%] -translate-y-1/2 -translate-x-1/2 pointer-events-none z-10 flex flex-col items-center"
                style={{ left: `${todayX}px` }}
              >
                {/* Subtle vertical indicator notch spanning the rail */}
                <div className="h-10 w-px bg-blue-500/50" />
                {/* Glowing Axis Node */}
                <div className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center">
                  <span className="h-4 w-4 rounded-full bg-blue-500/20 border border-blue-400/40 animate-ping absolute" />
                  <span className="h-2 w-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400" />
                </div>
                {/* Compact Today Tag below the notch */}
                <div className="mt-6 flex items-center gap-1 rounded px-1.5 py-0.5 bg-blue-500/15 border border-blue-500/30 text-[9px] font-mono font-medium text-blue-400 uppercase tracking-wider backdrop-blur-sm">
                  <span className="h-1 w-1 rounded-full bg-blue-400 animate-pulse" />
                  <span>{c.today}</span>
                </div>
              </div>
            )}

            {/* Event Markers & Nodes (Direct Click Navigation + Hover Details Popover) */}
            {timelineNodes.map((node) => {
              if (node.x < -180 || node.x > containerWidth + 180) return null;

              const isCluster = node.type === "cluster";
              const yOffset = getLaneOffset(node.lane);
              const isAbove = yOffset < 0;
              const cfg =
                CATEGORY_CONFIG[node.primaryEvent.category] || CATEGORY_CONFIG.milestone;
              const Icon = cfg.icon;
              const isMajor = node.primaryEvent.importance === "major";
              const destinationHref = node.primaryEvent.link?.href || "#";

              return (
                <div
                  key={node.id}
                  className="absolute z-20 transition-transform duration-100 ease-out"
                  style={{
                    left: `${node.x}px`,
                    top: `calc(54% + ${yOffset}px)`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  {/* Stem Connector Linking Marker to the Central Rail */}
                  <div
                    className={cn(
                      "absolute left-1/2 -translate-x-1/2 w-px pointer-events-none transition-colors",
                      isAbove ? "top-full" : "bottom-full",
                      isMajor ? "bg-white/30" : "bg-white/12"
                    )}
                    style={{
                      height: `${Math.abs(yOffset) - 14}px`,
                    }}
                  />

                  {/* Rail Anchor Dot */}
                  <div
                    className={cn(
                      "absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none transition-all",
                      isAbove
                        ? "top-[calc(100%+" + (Math.abs(yOffset) - 16) + "px)]"
                        : "bottom-[calc(100%+" + (Math.abs(yOffset) - 16) + "px)]",
                      isMajor ? cn("h-1.5 w-1.5", cfg.pinBg) : "h-1 w-1 bg-white/40"
                    )}
                  />

                  {/* Marker Node Element */}
                  {isCluster ? (
                    /* Cluster Badge (Hover shows preview, Click zooms into period) */
                    <button
                      type="button"
                      onClick={() => handleZoomIntoCluster(node.events)}
                      onMouseEnter={() => {
                        setHoveredCluster({
                          events: node.events,
                          x: node.x,
                          y: yOffset,
                          isAbove,
                        });
                      }}
                      onMouseLeave={() => setHoveredCluster(null)}
                      className={cn(
                        "group relative flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-all focus:outline-none cursor-pointer",
                        "bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] hover:border-blue-500/40"
                      )}
                    >
                      <Layers className="h-3 w-3 text-blue-400" />
                      <span className="font-mono text-[11px] font-semibold">
                        +{node.events.length}
                      </span>
                    </button>
                  ) : (
                    /* Individual Event Marker: Direct Link Click + Hover Details Popover */
                    <Link
                      href={destinationHref}
                      onMouseEnter={() => {
                        setHoveredEvent(node.primaryEvent);
                        setHoverPosition({
                          x: node.x,
                          y: yOffset,
                          isAbove,
                        });
                      }}
                      onMouseLeave={() => {
                        setHoveredEvent(null);
                        setHoverPosition(null);
                      }}
                      className="group relative flex items-center gap-2 text-left transition-all focus:outline-none py-1 px-1.5 rounded-lg hover:bg-white/[0.04] cursor-pointer"
                    >
                      {/* Beacon Marker Pin */}
                      <div
                        className={cn(
                          "flex shrink-0 items-center justify-center rounded-md transition-transform group-hover:scale-110",
                          isMajor ? "h-6 w-6" : "h-4 w-4",
                          isMajor ? "bg-white/[0.06] border border-white/[0.12]" : "bg-transparent"
                        )}
                        style={
                          isMajor
                            ? {
                                borderColor: `${cfg.accentColor}60`,
                                backgroundColor: `${cfg.accentColor}15`,
                              }
                            : undefined
                        }
                      >
                        {isMajor ? (
                          <Icon className="h-3.5 w-3.5" style={{ color: cfg.accentColor }} />
                        ) : (
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: cfg.accentColor }}
                          />
                        )}
                      </div>

                      {/* Attached Typography (No Card Wrapper) */}
                      <div className="flex flex-col min-w-0">
                        <span
                          className={cn(
                            "truncate transition-colors leading-tight",
                            isMajor
                              ? "text-xs font-semibold text-zinc-100 group-hover:text-blue-400 max-w-[175px]"
                              : "text-[11px] font-medium text-zinc-300 group-hover:text-white max-w-[135px]"
                          )}
                        >
                          {node.primaryEvent.title}
                        </span>

                        {/* Date subtitle visible on timeline */}
                        <span
                          className="text-[9px] font-mono text-zinc-400 mt-0.5"
                          suppressHydrationWarning
                        >
                          {new Date(node.primaryEvent.timestamp).toLocaleDateString(intlLocale, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </Link>
                  )}
                </div>
              );
            })}

            {/* FLOATING HOVER DETAILS POPOVER (Safely oriented inward towards the central rail to prevent clipping) */}
            {hoveredEvent && hoverPosition && (
              <div
                className="absolute z-50 pointer-events-none transition-all duration-150 ease-out animate-in fade-in zoom-in-95"
                style={{
                  left: `${Math.max(160, Math.min(containerWidth - 160, hoverPosition.x))}px`,
                  top: hoverPosition.isAbove
                    ? `calc(54% + ${hoverPosition.y + 18}px)`
                    : `calc(54% + ${hoverPosition.y - 18}px)`,
                  transform: hoverPosition.isAbove ? "translate(-50%, 0%)" : "translate(-50%, -100%)",
                }}
              >
                <div className="w-72 rounded-xl border border-white/[0.12] bg-[#16181D]/95 p-3.5 shadow-2xl backdrop-blur-md space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <span
                      className="inline-flex items-center gap-1.5 font-semibold text-[11px]"
                      style={{
                        color: (CATEGORY_CONFIG[hoveredEvent.category] || CATEGORY_CONFIG.milestone).accentColor,
                      }}
                    >
                      {React.createElement(
                        (CATEGORY_CONFIG[hoveredEvent.category] || CATEGORY_CONFIG.milestone).icon,
                        { className: "h-3.5 w-3.5" }
                      )}
                      <span>{c[(CATEGORY_CONFIG[hoveredEvent.category] || CATEGORY_CONFIG.milestone).labelKey]}</span>
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 border border-white/[0.08] rounded px-1.5 py-0.5">
                      {hoveredEvent.importance === "major"
                        ? c.majorMilestone
                        : hoveredEvent.importance === "normal"
                        ? c.normalMilestone
                        : c.minorActivity}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-semibold text-white text-xs leading-snug">
                      {hoveredEvent.title}
                    </h4>
                    <p className="text-[11px] text-zinc-300 leading-relaxed line-clamp-3">
                      {hoveredEvent.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/[0.06] space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        <Calendar className="h-3 w-3" />
                        <span suppressHydrationWarning>
                          {new Date(hoveredEvent.timestamp).toLocaleDateString(intlLocale, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        <Clock className="h-3 w-3" />
                        <span suppressHydrationWarning>
                          {new Date(hoveredEvent.timestamp).toLocaleTimeString(intlLocale, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                    </div>

                    {hoveredEvent.author && (
                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <span className="text-zinc-500">{c.author}:</span>
                        <span className="text-zinc-200 font-medium">{hoveredEvent.author.name}</span>
                      </div>
                    )}
                  </div>

                  {hoveredEvent.link && (
                    <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-end text-[10px] text-blue-400 font-medium">
                      <span className="flex items-center gap-1">
                        {hoveredEvent.link.label || c.openEntity} →
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FLOATING CLUSTER PREVIEW POPOVER (Safely oriented inward towards the central rail) */}
            {hoveredCluster && (
              <div
                className="absolute z-50 pointer-events-none transition-all duration-150 ease-out animate-in fade-in zoom-in-95"
                style={{
                  left: `${Math.max(140, Math.min(containerWidth - 140, hoveredCluster.x))}px`,
                  top: hoveredCluster.isAbove
                    ? `calc(54% + ${hoveredCluster.y + 16}px)`
                    : `calc(54% + ${hoveredCluster.y - 16}px)`,
                  transform: hoveredCluster.isAbove ? "translate(-50%, 0%)" : "translate(-50%, -100%)",
                }}
              >
                <div className="w-64 rounded-xl border border-white/[0.12] bg-[#16181D]/95 p-3 shadow-2xl backdrop-blur-md space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 border-b border-white/[0.06] pb-1.5">
                    <Layers className="h-3.5 w-3.5 text-blue-400" />
                    <span className="font-semibold text-white text-xs">
                      {hoveredCluster.events.length} {c.clusterInspectTitle}
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-hidden">
                    {hoveredCluster.events.slice(0, 4).map((item) => (
                      <div key={item.id} className="text-[11px] truncate text-zinc-300">
                        • {item.title}
                      </div>
                    ))}
                    {hoveredCluster.events.length > 4 && (
          <div className="text-[10px] text-zinc-500 font-mono">
                        +{hoveredCluster.events.length - 4} outros...
                      </div>
                    )}
                  </div>
                  <div className="pt-1 border-t border-white/[0.06] text-[10px] text-blue-400 font-medium">
                    Clique para aproximar este período →
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {filteredEvents.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-zinc-400">
                <Clock className="h-8 w-8 text-zinc-600 mb-2" />
                <p className="text-xs">{c.noEvents}</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                    setSelectedTimeRange("all");
                    handleResetView();
                  }}
                  className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  {c.resetView}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SECONDARY CHRONOLOGICAL LIST VIEW */
        <div className="overflow-x-auto py-2">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/[0.08] text-zinc-400 uppercase tracking-wider text-[10px] font-mono">
              <tr>
                <th className="py-2.5 px-3">{c.date}</th>
                <th className="py-2.5 px-3">{c.category}</th>
                <th className="py-2.5 px-3">Título & Descrição</th>
                <th className="py-2.5 px-3">{c.author}</th>
                <th className="py-2.5 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-zinc-300 font-sans">
              {filteredEvents.map((event) => {
                const cfg = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.milestone;
                const Icon = cfg.icon;

                return (
                  <tr
                    key={event.id}
                    className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                      {new Date(event.timestamp).toLocaleDateString(intlLocale, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: cfg.accentColor }}>
                        <Icon className="h-3 w-3" />
                        <span>{c[cfg.labelKey]}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 max-w-md">
                      <Link href={event.link?.href || "#"} className="hover:text-blue-400 transition-colors">
                        <p className="font-semibold text-white truncate">{event.title}</p>
                        <p className="text-[11px] text-zinc-400 line-clamp-1">{event.description}</p>
                      </Link>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="text-zinc-300 text-xs">
                        {event.author?.name || "Workspace"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {event.link && (
                        <Link
                          href={event.link.href}
                          className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                        >
                          <span>{c.openEntity}</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
