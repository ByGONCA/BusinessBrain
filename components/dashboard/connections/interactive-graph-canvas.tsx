"use client";

// ==============================================================================
// Company Brain: Interactive Force-Directed Graph Canvas
// High-performance, zero-dependency HTML5 Canvas implementation
// Features abstract geometric entity nodes, vector iconography, zero images,
// dynamic edge relationship badges, and lightweight hover tooltips.
// ==============================================================================

import * as React from "react";
import {
  GraphNode,
  GraphEdge,
  EntityType,
} from "@/lib/connections/types";
import { cn } from "@/lib/utils";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  FolderGit2,
  CheckSquare,
  Scale,
  Calendar,
  Target,
  User,
  ArrowRight,
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

interface HoverState {
  type: "node" | "edge";
  node?: SimNode;
  edge?: SimEdge;
  screenX: number;
  screenY: number;
}

// Visual configuration for abstract geometric entity nodes
interface EntityStyle {
  label: string;
  color: string;
  bgDark: string;
  bgLight: string;
  borderDark: string;
  borderLight: string;
  glow: string;
  shape: "circle" | "rounded-rect" | "hexagon" | "diamond" | "octagon";
  lucideIcon: React.ComponentType<{ className?: string }>;
}

const ENTITY_STYLES: Record<EntityType, EntityStyle> = {
  page: {
    label: "Page",
    color: "#94a3b8", // slate-400
    bgDark: "#1e293b",
    bgLight: "#f1f5f9",
    borderDark: "#475569",
    borderLight: "#cbd5e1",
    glow: "rgba(148, 163, 184, 0.4)",
    shape: "rounded-rect",
    lucideIcon: FileText,
  },
  project: {
    label: "Project",
    color: "#818cf8", // indigo-400
    bgDark: "#1e1b4b",
    bgLight: "#e0e7ff",
    borderDark: "#6366f1",
    borderLight: "#a5b4fc",
    glow: "rgba(129, 140, 248, 0.4)",
    shape: "rounded-rect",
    lucideIcon: FolderGit2,
  },
  task: {
    label: "Task",
    color: "#60a5fa", // blue-400
    bgDark: "#172554",
    bgLight: "#dbeafe",
    borderDark: "#3b82f6",
    borderLight: "#93c5fd",
    glow: "rgba(96, 165, 250, 0.4)",
    shape: "hexagon",
    lucideIcon: CheckSquare,
  },
  decision: {
    label: "Decision",
    color: "#fbbf24", // amber-400
    bgDark: "#451a03",
    bgLight: "#fef3c7",
    borderDark: "#f59e0b",
    borderLight: "#fde68a",
    glow: "rgba(251, 191, 36, 0.4)",
    shape: "diamond",
    lucideIcon: Scale,
  },
  meeting: {
    label: "Meeting",
    color: "#c084fc", // purple-400
    bgDark: "#3b0764",
    bgLight: "#f3e8ff",
    borderDark: "#a855f7",
    borderLight: "#d8b4fe",
    glow: "rgba(192, 132, 252, 0.4)",
    shape: "octagon",
    lucideIcon: Calendar,
  },
  goal: {
    label: "Goal",
    color: "#34d399", // emerald-400
    bgDark: "#022c22",
    bgLight: "#d1fae5",
    borderDark: "#10b981",
    borderLight: "#a7f3d0",
    glow: "rgba(52, 211, 153, 0.4)",
    shape: "circle",
    lucideIcon: Target,
  },
  person: {
    label: "Person",
    color: "#fb923c", // orange-400
    bgDark: "#431407",
    bgLight: "#ffedd5",
    borderDark: "#f97316",
    borderLight: "#fdba74",
    glow: "rgba(251, 146, 60, 0.4)",
    shape: "circle",
    lucideIcon: User,
  },
  document: {
    label: "Document",
    color: "#22d3ee", // cyan-400
    bgDark: "#083344",
    bgLight: "#cffafe",
    borderDark: "#06b6d4",
    borderLight: "#67e8f9",
    glow: "rgba(34, 211, 238, 0.4)",
    shape: "rounded-rect",
    lucideIcon: FileText,
  },
};

/**
 * Renders standard geometric silhouettes for nodes on canvas.
 */
function drawNodeShape(
  c: CanvasRenderingContext2D,
  shape: "circle" | "rounded-rect" | "hexagon" | "diamond" | "octagon",
  cx: number,
  cy: number,
  r: number
) {
  c.beginPath();
  switch (shape) {
    case "rounded-rect":
      if (typeof c.roundRect === "function") {
        c.roundRect(cx - r, cy - r, r * 2, r * 2, r * 0.35);
      } else {
        c.rect(cx - r, cy - r, r * 2, r * 2);
      }
      break;
    case "diamond":
      c.moveTo(cx, cy - r * 1.15);
      c.lineTo(cx + r * 1.15, cy);
      c.lineTo(cx, cy + r * 1.15);
      c.lineTo(cx - r * 1.15, cy);
      c.closePath();
      break;
    case "hexagon": {
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 - Math.PI / 6;
        const px = cx + r * 1.05 * Math.cos(angle);
        const py = cy + r * 1.05 * Math.sin(angle);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      break;
    }
    case "octagon": {
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 - Math.PI / 8;
        const px = cx + r * 1.05 * Math.cos(angle);
        const py = cy + r * 1.05 * Math.sin(angle);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      break;
    }
    case "circle":
    default:
      c.arc(cx, cy, r, 0, Math.PI * 2);
      break;
  }
}

/**
 * Draws sharp, scalable 2D vector icons centered at (x, y) with zero image dependencies.
 */
function drawVectorIcon(
  c: CanvasRenderingContext2D,
  type: EntityType,
  x: number,
  y: number,
  size: number,
  color: string
) {
  c.save();
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 1.7;
  c.lineCap = "round";
  c.lineJoin = "round";

  switch (type) {
    case "page": {
      // Document with folded top-right corner and lines
      const w = size * 0.7;
      const h = size * 0.9;
      const x0 = x - w / 2;
      const y0 = y - h / 2;
      const fold = size * 0.25;

      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x0 + w - fold, y0);
      c.lineTo(x0 + w, y0 + fold);
      c.lineTo(x0 + w, y0 + h);
      c.lineTo(x0, y0 + h);
      c.closePath();
      c.stroke();

      // Fold corner
      c.beginPath();
      c.moveTo(x0 + w - fold, y0);
      c.lineTo(x0 + w - fold, y0 + fold);
      c.lineTo(x0 + w, y0 + fold);
      c.stroke();

      // Horizontal lines
      c.beginPath();
      c.moveTo(x0 + w * 0.25, y0 + h * 0.45);
      c.lineTo(x0 + w * 0.75, y0 + h * 0.45);
      c.moveTo(x0 + w * 0.25, y0 + h * 0.7);
      c.lineTo(x0 + w * 0.6, y0 + h * 0.7);
      c.stroke();
      break;
    }

    case "project": {
      // Folder icon
      const w = size * 0.9;
      const h = size * 0.7;
      const x0 = x - w / 2;
      const y0 = y - h / 2 + 1;
      const tabW = w * 0.4;
      const tabH = h * 0.25;

      c.beginPath();
      c.moveTo(x0, y0 + tabH);
      c.lineTo(x0, y0);
      c.lineTo(x0 + tabW, y0);
      c.lineTo(x0 + tabW + 3, y0 + tabH);
      c.lineTo(x0 + w, y0 + tabH);
      c.lineTo(x0 + w, y0 + h);
      c.lineTo(x0, y0 + h);
      c.closePath();
      c.stroke();
      break;
    }

    case "task": {
      // Checkbox with crisp checkmark
      const box = size * 0.75;
      const x0 = x - box / 2;
      const y0 = y - box / 2;
      c.beginPath();
      if (typeof c.roundRect === "function") {
        c.roundRect(x0, y0, box, box, 3);
      } else {
        c.rect(x0, y0, box, box);
      }
      c.stroke();

      // Checkmark inside
      c.beginPath();
      c.moveTo(x0 + box * 0.22, y0 + box * 0.52);
      c.lineTo(x0 + box * 0.44, y0 + box * 0.75);
      c.lineTo(x0 + box * 0.8, y0 + box * 0.28);
      c.stroke();
      break;
    }

    case "decision": {
      // Diamond scale
      const r = size * 0.45;
      c.beginPath();
      c.moveTo(x, y - r);
      c.lineTo(x + r, y);
      c.lineTo(x, y + r);
      c.lineTo(x - r, y);
      c.closePath();
      c.stroke();

      // Center fulcrum point
      c.beginPath();
      c.arc(x, y, 2, 0, Math.PI * 2);
      c.fill();
      break;
    }

    case "meeting": {
      // Calendar icon
      const w = size * 0.8;
      const h = size * 0.8;
      const x0 = x - w / 2;
      const y0 = y - h / 2 + 1;

      c.beginPath();
      if (typeof c.roundRect === "function") {
        c.roundRect(x0, y0, w, h, 3);
      } else {
        c.rect(x0, y0, w, h);
      }
      c.stroke();

      // Header line
      c.beginPath();
      c.moveTo(x0, y0 + h * 0.32);
      c.lineTo(x0 + w, y0 + h * 0.32);
      c.stroke();

      // Top binder pins
      c.beginPath();
      c.moveTo(x0 + w * 0.28, y0 - 2.5);
      c.lineTo(x0 + w * 0.28, y0 + 3);
      c.moveTo(x0 + w * 0.72, y0 - 2.5);
      c.lineTo(x0 + w * 0.72, y0 + 3);
      c.stroke();

      // Mini grid dots
      c.beginPath();
      c.arc(x0 + w * 0.35, y0 + h * 0.62, 1.4, 0, Math.PI * 2);
      c.arc(x0 + w * 0.65, y0 + h * 0.62, 1.4, 0, Math.PI * 2);
      c.fill();
      break;
    }

    case "goal": {
      // Target bullseye
      c.beginPath();
      c.arc(x, y, size * 0.42, 0, Math.PI * 2);
      c.stroke();

      c.beginPath();
      c.arc(x, y, size * 0.22, 0, Math.PI * 2);
      c.stroke();

      c.beginPath();
      c.arc(x, y, 2, 0, Math.PI * 2);
      c.fill();
      break;
    }

    case "person": {
      // Person avatar outline
      const headR = size * 0.22;
      c.beginPath();
      c.arc(x, y - headR * 0.8, headR, 0, Math.PI * 2);
      c.stroke();

      // Shoulders arc
      c.beginPath();
      c.arc(x, y + size * 0.55, size * 0.42, Math.PI * 1.25, Math.PI * 1.75);
      c.stroke();
      break;
    }

    case "document":
    default: {
      // Document sheet with lines
      const w = size * 0.75;
      const h = size * 0.9;
      const x0 = x - w / 2;
      const y0 = y - h / 2;

      c.beginPath();
      if (typeof c.roundRect === "function") {
        c.roundRect(x0, y0, w, h, 2);
      } else {
        c.rect(x0, y0, w, h);
      }
      c.stroke();

      c.beginPath();
      c.moveTo(x0 + w * 0.22, y0 + h * 0.35);
      c.lineTo(x0 + w * 0.78, y0 + h * 0.35);
      c.moveTo(x0 + w * 0.22, y0 + h * 0.55);
      c.lineTo(x0 + w * 0.78, y0 + h * 0.55);
      c.moveTo(x0 + w * 0.22, y0 + h * 0.75);
      c.lineTo(x0 + w * 0.55, y0 + h * 0.75);
      c.stroke();
      break;
    }
  }

  c.restore();
}

/**
 * Calculates Euclidean distance from point (px, py) to line segment (x1, y1)-(x2, y2).
 */
function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const dpx = px - x1;
    const dpy = py - y1;
    return Math.sqrt(dpx * dpx + dpy * dpy);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const distDx = px - projX;
  const distDy = py - projY;
  return Math.sqrt(distDx * distDx + distDy * distDy);
}

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
  const hoveredEdgeRef = React.useRef<SimEdge | null>(null);

  // Lightweight UI hover tooltip state
  const [hoverState, setHoverState] = React.useState<HoverState | null>(null);

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

    // Convert to SimNodes with radius scaled by connectivity
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
        radius: Math.min(26, Math.max(16, 15 + (n.degree || 0) * 2.2)),
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

  // Smoothly center on selected node if changed externally (e.g. from search or deep-link)
  React.useEffect(() => {
    if (!selectedNodeId || !containerRef.current) return;
    const target = simNodesRef.current.find((n) => n.id === selectedNodeId);
    if (!target) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const currentScale = transformRef.current.scale;

    setTransform((prev) => ({
      ...prev,
      x: width / 2 - target.x * currentScale,
      y: height / 2 - target.y * currentScale,
    }));
  }, [selectedNodeId]);

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
        const isHoveredEdge = hoveredEdgeRef.current?.id === e.id;
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
        } else if (isHoveredEdge) {
          c.strokeStyle = isDark ? "#93c5fd" : "#3b82f6";
          c.lineWidth = 2.8 / currentT.scale;
          c.shadowColor = "rgba(59, 130, 246, 0.4)";
          c.shadowBlur = 8;
        } else if (isSelectedEdge) {
          c.strokeStyle = isDark ? "#60a5fa" : "#2563eb";
          c.lineWidth = 2.2 / currentT.scale;
        } else if (isDimmed) {
          c.strokeStyle = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";
          c.lineWidth = 1 / currentT.scale;
        } else {
          c.strokeStyle = isDark ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0.15)";
          c.lineWidth = 1.3 / currentT.scale;
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

        // Dynamic Relationship Badge: only render when hovered or connected to selected node
        const shouldShowEdgeLabel = isHoveredEdge || isPathEdge || (isSelectedEdge && currentT.scale >= 0.55);

        if (shouldShowEdgeLabel) {
          const midX = (e.sourceNode.x + e.targetNode.x) / 2;
          const midY = (e.sourceNode.y + e.targetNode.y) / 2;

          c.save();
          const fontSize = Math.max(9, Math.min(13, 11 / currentT.scale));
          c.font = `600 ${fontSize}px sans-serif`;
          c.textAlign = "center";
          c.textBaseline = "middle";

          const textMetrics = c.measureText(e.label);
          const bgPaddingX = 6 / currentT.scale;
          const bgPaddingY = 3 / currentT.scale;
          const pillW = textMetrics.width + bgPaddingX * 2;
          const pillH = fontSize + bgPaddingY * 2;

          // Relationship pill backdrop
          c.beginPath();
          if (typeof c.roundRect === "function") {
            c.roundRect(midX - pillW / 2, midY - pillH / 2, pillW, pillH, 4 / currentT.scale);
          } else {
            c.rect(midX - pillW / 2, midY - pillH / 2, pillW, pillH);
          }
          c.fillStyle = isPathEdge
            ? "#064e3b"
            : isDark
            ? "rgba(24, 24, 27, 0.92)"
            : "rgba(255, 255, 255, 0.95)";
          c.fill();

          c.lineWidth = 1 / currentT.scale;
          c.strokeStyle = isPathEdge
            ? "#10b981"
            : isDark
            ? "rgba(255, 255, 255, 0.15)"
            : "rgba(0, 0, 0, 0.15)";
          c.stroke();

          // Relationship pill text
          c.fillStyle = isPathEdge
            ? "#34d399"
            : isDark
            ? "#f4f4f5"
            : "#18181b";
          c.fillText(e.label, midX, midY);
          c.restore();
        }

        c.restore();
      }

      // 2. Draw Nodes (Strict Abstract Geometric Entities - Zero Images)
      for (const n of sn) {
        const isSelected = n.id === selId;
        const isHovered = hoveredNodeRef.current?.id === n.id;
        const isPathNode = pathNodeSet.has(n.id);
        const isConnected = connectedNodeIds.has(n.id);
        const isDimmed =
          (selId && focusDepth !== null && !isConnected) ||
          (pathNodeSet.size > 0 && !isPathNode);

        const style = ENTITY_STYLES[n.type] || ENTITY_STYLES.document;

        c.save();

        if (isDimmed) {
          c.globalAlpha = 0.15;
        }

        // A. Selected / Path / Hover Outer Glow
        if (isSelected || isPathNode || isHovered) {
          c.save();
          drawNodeShape(c, style.shape, n.x, n.y, n.radius + 6 / currentT.scale);
          c.fillStyle = isPathNode ? "rgba(16, 185, 129, 0.3)" : style.glow;
          c.fill();
          c.restore();
        }

        // B. Node Background Fill
        drawNodeShape(c, style.shape, n.x, n.y, n.radius);
        c.fillStyle = isPathNode
          ? "#059669"
          : isSelected
          ? isDark ? style.bgDark : style.bgLight
          : isHovered
          ? isDark ? style.bgDark : style.bgLight
          : isDark ? style.bgDark : style.bgLight;
        c.fill();

        // C. Node Geometric Border
        c.lineWidth = (isSelected ? 3.2 : isHovered ? 2.4 : 1.8) / currentT.scale;
        c.strokeStyle = isSelected
          ? "#ffffff"
          : isPathNode
          ? "#6ee7b7"
          : isDark
          ? style.borderDark
          : style.borderLight;
        c.stroke();

        // D. Crisp Vector Icon Inside Node (100% Vector Geometry)
        const iconSize = Math.max(12, n.radius * 0.95);
        const iconColor = isPathNode
          ? "#ffffff"
          : isSelected
          ? "#ffffff"
          : style.color;

        drawVectorIcon(c, n.type, n.x, n.y, iconSize, iconColor);

        // E. Node Title Label (Level of Detail Rendering)
        if (currentT.scale >= 0.55 || isSelected || isHovered || isPathNode) {
          const fontSize = Math.max(10, Math.min(13, 11 / currentT.scale));
          c.font = `600 ${fontSize}px sans-serif`;
          c.textAlign = "center";
          c.textBaseline = "top";

          const label = n.title.length > 22 ? n.title.slice(0, 20) + "…" : n.title;
          const textMetrics = c.measureText(label);
          const pillPaddingX = 5 / currentT.scale;
          const pillPaddingY = 2 / currentT.scale;
          const pillW = textMetrics.width + pillPaddingX * 2;
          const pillH = fontSize + pillPaddingY * 2;
          const labelY = n.y + n.radius + 5 / currentT.scale;

          // Backdrop pill for high contrast legibility over intersecting edges
          c.beginPath();
          if (typeof c.roundRect === "function") {
            c.roundRect(
              n.x - pillW / 2,
              labelY - pillPaddingY,
              pillW,
              pillH,
              3 / currentT.scale
            );
          } else {
            c.rect(n.x - pillW / 2, labelY - pillPaddingY, pillW, pillH);
          }
          c.fillStyle = isDark
            ? "rgba(18, 18, 22, 0.85)"
            : "rgba(255, 255, 255, 0.9)";
          c.fill();

          c.fillStyle = isDark ? "#f4f4f5" : "#09090b";
          c.fillText(label, n.x, labelY);
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

    // Edge hit testing if no node is hovered
    let hitEdge: SimEdge | null = null;
    if (!hitNode) {
      const edgeThreshold = 8 / transformRef.current.scale;
      for (const edge of simEdgesRef.current) {
        const dist = distToSegment(
          x,
          y,
          edge.sourceNode.x,
          edge.sourceNode.y,
          edge.targetNode.x,
          edge.targetNode.y
        );
        if (dist <= edgeThreshold) {
          hitEdge = edge;
          break;
        }
      }
    }
    hoveredEdgeRef.current = hitEdge;

    // Update cursor
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hitNode
        ? "pointer"
        : hitEdge
        ? "pointer"
        : isInteractingRef.current
        ? "grabbing"
        : "grab";
    }

    // Update lightweight hover card tooltip
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;

      if (hitNode) {
        setHoverState({
          type: "node",
          node: hitNode,
          screenX: relX,
          screenY: relY,
        });
      } else if (hitEdge) {
        setHoverState({
          type: "edge",
          edge: hitEdge,
          screenX: relX,
          screenY: relY,
        });
      } else {
        setHoverState(null);
      }
    }

    // Pan canvas or drag node
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
      className={cn(
        "relative w-full h-full overflow-hidden select-none bg-zinc-50/50 dark:bg-zinc-950/50",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          handleMouseUp();
          setHoverState(null);
        }}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        className="w-full h-full block"
      />

      {/* Lightweight Hover Card Tooltip (Strictly Image-Free) */}
      {hoverState && hoverState.type === "node" && hoverState.node && (
        <div
          className="absolute pointer-events-none z-30 transform -translate-x-1/2 -translate-y-full mb-3 px-3 py-2 rounded-xl bg-popover/95 backdrop-blur-md border border-border shadow-xl text-left transition-all animate-in fade-in-0 zoom-in-95 duration-150"
          style={{
            left: `${hoverState.screenX}px`,
            top: `${hoverState.screenY - 10}px`,
            maxWidth: "240px",
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
              style={{
                color: ENTITY_STYLES[hoverState.node.type]?.color || "#94a3b8",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              {React.createElement(
                ENTITY_STYLES[hoverState.node.type]?.lucideIcon || FileText,
                { className: "h-3 w-3" }
              )}
              {ENTITY_STYLES[hoverState.node.type]?.label || hoverState.node.type}
            </span>
          </div>

          <h4 className="text-xs font-bold text-foreground truncate">
            {hoverState.node.title}
          </h4>

          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
            <span>
              <strong className="text-foreground">{hoverState.node.degree}</strong> connections
            </span>
            <span>•</span>
            <span>{hoverState.node.outDegree} out</span>
            <span>•</span>
            <span>{hoverState.node.inDegree} in</span>
          </div>
        </div>
      )}

      {/* Lightweight Edge Hover Card */}
      {hoverState && hoverState.type === "edge" && hoverState.edge && (
        <div
          className="absolute pointer-events-none z-30 transform -translate-x-1/2 -translate-y-full mb-3 px-3 py-1.5 rounded-lg bg-popover/95 backdrop-blur-md border border-border shadow-md text-xs font-medium text-foreground transition-all animate-in fade-in-0 zoom-in-95 duration-150"
          style={{
            left: `${hoverState.screenX}px`,
            top: `${hoverState.screenY - 8}px`,
          }}
        >
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="font-semibold text-muted-foreground truncate max-w-[90px]">
              {hoverState.edge.sourceNode.title}
            </span>
            <span className="text-blue-500 font-bold px-1 py-0.5 rounded bg-blue-500/10 text-[10px]">
              {hoverState.edge.label}
            </span>
            <span className="font-semibold text-muted-foreground truncate max-w-[90px]">
              {hoverState.edge.targetNode.title}
            </span>
          </div>
        </div>
      )}

      {/* Floating Canvas Controls (Fit, Zoom In, Zoom Out) */}
      <div className="absolute bottom-5 right-5 flex items-center gap-1.5 p-1 rounded-xl bg-background/90 backdrop-blur-md border border-border shadow-md">
        <button
          type="button"
          onClick={() =>
            setTransform((prev) => ({
              ...prev,
              scale: Math.min(3.5, prev.scale * 1.2),
            }))
          }
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <div className="h-4 w-px bg-border mx-0.5" />
        <button
          type="button"
          onClick={fitToView}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Fit graph to view"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Abstract Entity Legend Pill */}
      <div className="absolute bottom-5 left-5 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-background/90 backdrop-blur-md border border-border shadow-xs text-[11px] text-muted-foreground">
        {(["project", "task", "decision", "meeting", "goal", "page"] as const).map(
          (t) => {
            const st = ENTITY_STYLES[t];
            return (
              <span key={t} className="flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: st.color }}
                />
                {st.label}
              </span>
            );
          }
        )}
      </div>
    </div>
  );
}
