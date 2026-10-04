"use client";

// ==============================================================================
// Company Brain: Interactive Force-Directed Graph Canvas
// High-performance, zero-dependency HTML5 Canvas implementation
// Supports pan, zoom, drag, focus mode, and shortest-path highlighting
// ==============================================================================

import * as React from "react";
import {
  GraphNode,
  GraphEdge,
  EntityType,
  RelationshipType,
} from "@/lib/connections/types";
import { cn } from "@/lib/utils";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
} from "lucide-react";

interface InteractiveGraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNode | null) => void;
  onOpenNode?: (node: GraphNode) => void;
  focusDepth: number | null; // null = all, 1 = 1 hop, 2 = 2 hops, 3 = 3 hops
  highlightedPathNodeIds?: string[];
  highlightedPathEdgeIds?: string[];
  filterType?: EntityType | "all";
  className?: string;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isDragging?: boolean;
}

interface SimEdge extends GraphEdge {
  sourceNode: SimNode;
  targetNode: SimNode;
}

const TYPE_COLORS: Record<EntityType, { bg: string; border: string; glow: string }> = {
  project: { bg: "#4f46e5", border: "#818cf8", glow: "rgba(99, 102, 241, 0.4)" }, // indigo
  task: { bg: "#2563eb", border: "#60a5fa", glow: "rgba(59, 130, 246, 0.4)" }, // blue
  decision: { bg: "#d97706", border: "#fbbf24", glow: "rgba(245, 158, 11, 0.4)" }, // amber
  meeting: { bg: "#9333ea", border: "#c084fc", glow: "rgba(168, 85, 247, 0.4)" }, // purple
  goal: { bg: "#059669", border: "#34d399", glow: "rgba(16, 185, 129, 0.4)" }, // emerald
  document: { bg: "#0891b2", border: "#22d3ee", glow: "rgba(6, 182, 212, 0.4)" }, // cyan
  person: { bg: "#ea580c", border: "#fb923c", glow: "rgba(249, 115, 22, 0.4)" }, // orange
  page: { bg: "#52525b", border: "#a1a1aa", glow: "rgba(113, 113, 122, 0.4)" }, // zinc
};

export function InteractiveGraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onOpenNode,
  focusDepth,
  highlightedPathNodeIds = [],
  highlightedPathEdgeIds = [],
  filterType = "all",
  className,
}: InteractiveGraphCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Transform (Pan & Zoom)
  const [transform, setTransform] = React.useState({ x: 0, y: 0, scale: 1 });
  const transformRef = React.useRef(transform);
  transformRef.current = transform;

  // Simulation internal state
  const simNodesRef = React.useRef<SimNode[]>([]);
  const simEdgesRef = React.useRef<SimEdge[]>([]);
  const isInteractingRef = React.useRef(false);
  const draggedNodeRef = React.useRef<SimNode | null>(null);
  const lastMousePosRef = React.useRef<{ x: number; y: number } | null>(null);
  const hoveredNodeRef = React.useRef<SimNode | null>(null);

  // 1. Initialize or update simulation data when nodes/edges change
  React.useEffect(() => {
    const existingPos = new Map<string, { x: number; y: number }>();
    for (const sn of simNodesRef.current) {
      existingPos.set(sn.id, { x: sn.x, y: sn.y });
    }

    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    // Filter nodes if filterType specified
    const filteredNodes =
      filterType === "all" ? nodes : nodes.filter((n) => n.type === filterType);
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

    // Convert to SimNodes
    const newSimNodes: SimNode[] = filteredNodes.map((n, i) => {
      const prev = existingPos.get(n.id);
      const angle = (i / Math.max(1, filteredNodes.length)) * Math.PI * 2;
      const radiusOffset = 80 + Math.random() * 120;

      return {
        ...n,
        x: prev ? prev.x : width / 2 + Math.cos(angle) * radiusOffset,
        y: prev ? prev.y : height / 2 + Math.sin(angle) * radiusOffset,
        vx: 0,
        vy: 0,
        radius: Math.min(28, Math.max(18, 16 + (n.degree || 0) * 2.5)),
      };
    });

    const simNodeMap = new Map<string, SimNode>();
    for (const sn of newSimNodes) {
      simNodeMap.set(sn.id, sn);
    }

    // Convert to SimEdges
    const newSimEdges: SimEdge[] = [];
    for (const edge of edges) {
      if (filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)) {
        const sourceNode = simNodeMap.get(edge.source);
        const targetNode = simNodeMap.get(edge.target);
        if (sourceNode && targetNode) {
          newSimEdges.push({
            ...edge,
            sourceNode,
            targetNode,
          });
        }
      }
    }

    simNodesRef.current = newSimNodes;
    simEdgesRef.current = newSimEdges;
  }, [nodes, edges, filterType]);

  // 2. Center/Fit to view
  const fitToView = React.useCallback(() => {
    const sn = simNodesRef.current;
    if (sn.length === 0 || !containerRef.current) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of sn) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }

    const padding = 100;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const graphWidth = Math.max(100, maxX - minX + padding * 2);
    const graphHeight = Math.max(100, maxY - minY + padding * 2);

    const scale = Math.min(2.0, Math.max(0.25, Math.min(width / graphWidth, height / graphHeight)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setTransform({
      x: width / 2 - centerX * scale,
      y: height / 2 - centerY * scale,
      scale,
    });
  }, []);

  // Auto fit once after mount
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fitToView();
    }, 200);
    return () => clearTimeout(timer);
  }, [fitToView]);

  // 3. Force-directed physical simulation loop + render loop
  React.useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const activeCanvas = canvas;
    const activeCtx = ctx;

    const repulsionStrength = 1800;
    const springLength = 110;
    const springStrength = 0.04;
    const centerStrength = 0.008;
    const damping = 0.85;

    function step() {
      const sn = simNodesRef.current;
      const se = simEdgesRef.current;
      const width = activeCanvas.width || 800;
      const height = activeCanvas.height || 600;
      const cx = width / 2;
      const cy = height / 2;

      // 1. Repulsion between nodes
      for (let i = 0; i < sn.length; i++) {
        const n1 = sn[i];
        for (let j = i + 1; j < sn.length; j++) {
          const n2 = sn[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);

          if (dist < 350) {
            const force = repulsionStrength / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!n1.isDragging) {
              n1.vx -= fx;
              n1.vy -= fy;
            }
            if (!n2.isDragging) {
              n2.vx += fx;
              n2.vy += fy;
            }
          }
        }
      }

      // 2. Spring forces along edges
      for (const e of se) {
        const dx = e.targetNode.x - e.sourceNode.x;
        const dy = e.targetNode.y - e.sourceNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - springLength) * springStrength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (!e.sourceNode.isDragging) {
          e.sourceNode.vx += fx;
          e.sourceNode.vy += fy;
        }
        if (!e.targetNode.isDragging) {
          e.targetNode.vx -= fx;
          e.targetNode.vy -= fy;
        }
      }

      // 3. Gentle centering & integrate velocities
      for (const n of sn) {
        if (!n.isDragging) {
          n.vx += (cx - n.x) * centerStrength;
          n.vy += (cy - n.y) * centerStrength;

          n.vx *= damping;
          n.vy *= damping;

          n.x += n.vx;
          n.y += n.vy;
        }
      }

      // 4. Render
      render(activeCtx, width, height);

      animId = requestAnimationFrame(step);
    }

    function render(c: CanvasRenderingContext2D, w: number, h: number) {
      c.save();
      c.clearRect(0, 0, w, h);

      const isDark = document.documentElement.classList.contains("dark");
      const currentT = transformRef.current;

      // Draw Subtle Background Grid
      c.save();
      c.strokeStyle = isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)";
      c.lineWidth = 1;
      const gridSize = 40 * currentT.scale;
      const offsetX = currentT.x % gridSize;
      const offsetY = currentT.y % gridSize;

      for (let x = offsetX; x < w; x += gridSize) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, h);
        c.stroke();
      }
      for (let y = offsetY; y < h; y += gridSize) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }
      c.restore();

      // Apply Pan & Zoom Transform
      c.translate(currentT.x, currentT.y);
      c.scale(currentT.scale, currentT.scale);

      const sn = simNodesRef.current;
      const se = simEdgesRef.current;
      const selId = selectedNodeId;
      const pathNodeSet = new Set(highlightedPathNodeIds);
      const pathEdgeSet = new Set(highlightedPathEdgeIds);

      // Connected nodes set for focus mode or selection
      const connectedNodeIds = new Set<string>();
      if (selId) {
        connectedNodeIds.add(selId);
        for (const e of se) {
          if (e.source === selId) connectedNodeIds.add(e.target);
          if (e.target === selId) connectedNodeIds.add(e.source);
        }
      }

      // 1. Draw Edges
      for (const e of se) {
        const isSelectedEdge = selId && (e.source === selId || e.target === selId);
        const isPathEdge = pathEdgeSet.has(e.id);
        const isDimmed =
          (selId && focusDepth !== null && !connectedNodeIds.has(e.source) && !connectedNodeIds.has(e.target)) ||
          (pathNodeSet.size > 0 && !isPathEdge);

        c.save();
        if (isPathEdge) {
          c.strokeStyle = "#10b981"; // emerald glow
          c.lineWidth = 3.5 / currentT.scale;
          c.shadowColor = "#10b981";
          c.shadowBlur = 10;
        } else if (isSelectedEdge) {
          c.strokeStyle = isDark ? "#60a5fa" : "#2563eb";
          c.lineWidth = 2.2 / currentT.scale;
        } else if (isDimmed) {
          c.strokeStyle = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
          c.lineWidth = 1 / currentT.scale;
        } else {
          c.strokeStyle = isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.15)";
          c.lineWidth = 1.4 / currentT.scale;
        }

        // Draw line
        c.beginPath();
        c.moveTo(e.sourceNode.x, e.sourceNode.y);
        c.lineTo(e.targetNode.x, e.targetNode.y);
        c.stroke();

        // Draw directed arrow head
        const dx = e.targetNode.x - e.sourceNode.x;
        const dy = e.targetNode.y - e.sourceNode.y;
        const angle = Math.atan2(dy, dx);
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Position arrow slightly before target node radius
        const arrowDist = dist - e.targetNode.radius - 4;
        if (arrowDist > 10) {
          const arrowX = e.sourceNode.x + Math.cos(angle) * arrowDist;
          const arrowY = e.sourceNode.y + Math.sin(angle) * arrowDist;
          const arrowSize = Math.max(4, 7 / currentT.scale);

          c.fillStyle = c.strokeStyle;
          c.beginPath();
          c.moveTo(arrowX, arrowY);
          c.lineTo(
            arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
            arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          c.lineTo(
            arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
            arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
          );
          c.closePath();
          c.fill();
        }

        // Subtle relationship type label along edge when zoomed in
        if (currentT.scale >= 0.75 && (isSelectedEdge || isPathEdge || !selId)) {
          const midX = (e.sourceNode.x + e.targetNode.x) / 2;
          const midY = (e.sourceNode.y + e.targetNode.y) / 2;

          c.save();
          c.font = `${Math.max(9, 10 / currentT.scale)}px sans-serif`;
          c.fillStyle = isPathEdge
            ? "#10b981"
            : isDark
            ? "rgba(255, 255, 255, 0.6)"
            : "rgba(0, 0, 0, 0.6)";
          c.textAlign = "center";
          c.textBaseline = "middle";

          // Background pill for label legibility
          const textMetrics = c.measureText(e.label);
          const bgPadding = 3;
          c.fillStyle = isDark ? "rgba(24, 24, 27, 0.85)" : "rgba(255, 255, 255, 0.85)";
          c.fillRect(
            midX - textMetrics.width / 2 - bgPadding,
            midY - 7 - bgPadding,
            textMetrics.width + bgPadding * 2,
            14 + bgPadding * 2
          );

          c.fillStyle = isPathEdge
            ? "#10b981"
            : isDark
            ? "#d4d4d8"
            : "#52525b";
          c.fillText(e.label, midX, midY);
          c.restore();
        }

        c.restore();
      }

      // 2. Draw Nodes
      for (const n of sn) {
        const isSelected = n.id === selId;
        const isHovered = hoveredNodeRef.current?.id === n.id;
        const isPathNode = pathNodeSet.has(n.id);
        const isConnected = connectedNodeIds.has(n.id);
        const isDimmed =
          (selId && focusDepth !== null && !isConnected) ||
          (pathNodeSet.size > 0 && !isPathNode);

        const colors = TYPE_COLORS[n.type] || TYPE_COLORS.document;

        c.save();

        if (isDimmed) {
          c.globalAlpha = 0.18;
        }

        // Selected / Path / Hover halo
        if (isSelected || isPathNode || isHovered) {
          c.beginPath();
          c.arc(n.x, n.y, n.radius + 6 / currentT.scale, 0, Math.PI * 2);
          c.fillStyle = isPathNode ? "rgba(16, 185, 129, 0.3)" : colors.glow;
          c.fill();
        }

        // Node Circle Background
        c.beginPath();
        c.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        c.fillStyle = isPathNode ? "#10b981" : colors.bg;
        c.fill();

        // Node Border
        c.lineWidth = (isSelected ? 3.5 : 2) / currentT.scale;
        c.strokeStyle = isSelected
          ? "#ffffff"
          : isPathNode
          ? "#6ee7b7"
          : colors.border;
        c.stroke();

        // Node Icon or Initials
        c.fillStyle = "#ffffff";
        c.font = `bold ${Math.max(10, n.radius * 0.9)}px sans-serif`;
        c.textAlign = "center";
        c.textBaseline = "middle";

        const iconGlyph = n.icon || n.type[0].toUpperCase();
        c.fillText(iconGlyph, n.x, n.y);

        // Node Label
        if (currentT.scale >= 0.55 || isSelected || isHovered || isPathNode) {
          c.font = `600 ${Math.max(10, 11 / currentT.scale)}px sans-serif`;
          c.textAlign = "center";
          c.textBaseline = "top";

          const label = n.title.length > 20 ? n.title.slice(0, 18) + "…" : n.title;

          // Label text
          c.fillStyle = isDark ? "#f4f4f5" : "#18181b";
          c.fillText(label, n.x, n.y + n.radius + 5 / currentT.scale);
        }

        c.restore();
      }

      c.restore();
    }

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [selectedNodeId, focusDepth, highlightedPathNodeIds, highlightedPathEdgeIds]);

  // Handle Resize for High-DPI Canvas
  React.useEffect(() => {
    function handleResize() {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 4. Mouse / Touch Interactions
  const screenToCanvas = React.useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const currentT = transformRef.current;
      return {
        x: (clientX - rect.left - currentT.x) / currentT.scale,
        y: (clientY - rect.top - currentT.y) / currentT.scale,
      };
    },
    []
  );

  const getNodeAtPoint = React.useCallback(
    (canvasX: number, canvasY: number): SimNode | null => {
      const sn = simNodesRef.current;
      for (let i = sn.length - 1; i >= 0; i--) {
        const n = sn[i];
        const dx = n.x - canvasX;
        const dy = n.y - canvasY;
        if (dx * dx + dy * dy <= n.radius * n.radius) {
          return n;
        }
      }
      return null;
    },
    []
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const hitNode = getNodeAtPoint(x, y);

    if (hitNode) {
      draggedNodeRef.current = hitNode;
      hitNode.isDragging = true;
      onSelectNode(hitNode);
    } else {
      isInteractingRef.current = true;
    }
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const hitNode = getNodeAtPoint(x, y);
    hoveredNodeRef.current = hitNode;

    if (canvasRef.current) {
      canvasRef.current.style.cursor = hitNode ? "pointer" : isInteractingRef.current ? "grabbing" : "grab";
    }

    if (!lastMousePosRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;

    if (draggedNodeRef.current) {
      const currentT = transformRef.current;
      draggedNodeRef.current.x += dx / currentT.scale;
      draggedNodeRef.current.y += dy / currentT.scale;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
    } else if (isInteractingRef.current) {
      setTransform((prev) => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy,
      }));
    }

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current.isDragging = false;
      draggedNodeRef.current = null;
    }
    isInteractingRef.current = false;
    lastMousePosRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform((prev) => {
      const nextScale = Math.min(3.5, Math.max(0.15, prev.scale * zoomFactor));
      const scaleRatio = nextScale / prev.scale;
      return {
        x: mouseX - (mouseX - prev.x) * scaleRatio,
        y: mouseY - (mouseY - prev.y) * scaleRatio,
        scale: nextScale,
      };
    });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const hitNode = getNodeAtPoint(x, y);
    if (hitNode && onOpenNode) {
      onOpenNode(hitNode);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full h-full overflow-hidden select-none bg-zinc-50/50 dark:bg-zinc-950/50", className)}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        className="w-full h-full block"
      />

      {/* Floating Canvas Controls (Fit, Zoom In, Zoom Out) */}
      <div className="absolute bottom-5 right-5 flex items-center gap-1.5 p-1 rounded-xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 shadow-md">
        <button
          type="button"
          onClick={() =>
            setTransform((prev) => ({
              ...prev,
              scale: Math.min(3.5, prev.scale * 1.2),
            }))
          }
          className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() =>
            setTransform((prev) => ({
              ...prev,
              scale: Math.max(0.15, prev.scale * 0.8),
            }))
          }
          className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5" />
        <button
          type="button"
          onClick={fitToView}
          className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Fit graph to view"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Type Legend Pill */}
      <div className="absolute bottom-5 left-5 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 shadow-xs text-[11px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-indigo-500" /> Project
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue-500" /> Task
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Decision
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-purple-500" /> Meeting
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Goal
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-zinc-500" /> Page
        </span>
      </div>
    </div>
  );
}
