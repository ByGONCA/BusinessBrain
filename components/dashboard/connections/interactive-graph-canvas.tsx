"use client";

// ==============================================================================
// Company Brain: Interactive Force-Directed Graph Canvas
// Obsidian-Inspired Minimalist Knowledge Graph View
// Pure circular nodes, fine elegant links, dynamic focus highlighting,
// zero card clutter, and smooth physical stabilization.
// ==============================================================================

import * as React from "react";
import {
  GraphNode,
  GraphEdge,
  EntityType,
} from "@/lib/connections/types";
import { computeDeterministicGraphLayout } from "@/lib/connections/graph-algorithms";
import { cn } from "@/lib/utils";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Target,
  X,
  FileText,
  FolderGit2,
  CheckSquare,
  Scale,
  Calendar,
  User,
} from "lucide-react";

interface InteractiveGraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNode | null) => void;
  onOpenNode?: (node: GraphNode) => void;
  focusDepth: number | null; // null = all, 1 = 1 hop, 2 = 2 hops, 3 = 3 hops
  onSetFocusDepth?: (depth: number | null) => void;
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

// Obsidian-style palette: discrete, cohesive, elegant colors per entity type
interface EntityStyle {
  label: string;
  color: string;
  lucideIcon: React.ComponentType<{ className?: string }>;
}

const ENTITY_STYLES: Record<EntityType, EntityStyle> = {
  page: { label: "Page", color: "#94a3b8", lucideIcon: FileText },
  project: { label: "Project", color: "#818cf8", lucideIcon: FolderGit2 },
  task: { label: "Task", color: "#38bdf8", lucideIcon: CheckSquare },
  decision: { label: "Decision", color: "#fbbf24", lucideIcon: Scale },
  meeting: { label: "Meeting", color: "#c084fc", lucideIcon: Calendar },
  goal: { label: "Goal", color: "#34d399", lucideIcon: Target },
  person: { label: "Person", color: "#fb923c", lucideIcon: User },
  document: { label: "Document", color: "#2dd4bf", lucideIcon: FileText },
};

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
  onSetFocusDepth,
  highlightedPathNodeIds = [],
  highlightedPathEdgeIds = [],
  filterType = "all",
  className,
}: InteractiveGraphCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Active selected node reference
  const selectedNode = React.useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  // Transform (Pan & Zoom)
  const [transform, setTransform] = React.useState({ x: 0, y: 0, scale: 1 });
  const transformRef = React.useRef(transform);
  transformRef.current = transform;

  // Dynamic wake reference for idle loop suspension (PERF-03)
  const wakeLoopRef = React.useRef<(minAlpha?: number) => void>(() => {});

  // Immediate synchronous transform update helper to avoid stale coordinate lag during rapid events
  const applyTransform = React.useCallback(
    (next: { x: number; y: number; scale: number }) => {
      transformRef.current = next;
      setTransform(next);
      wakeLoopRef.current();
    },
    []
  );

  // Exact zoom anchored at any screen coordinate (mouseX, mouseY) or viewport center
  const zoomAtPoint = React.useCallback(
    (screenX: number, screenY: number, factor: number) => {
      const prev = transformRef.current;
      const minScale = 0.15;
      const maxScale = 3.5;
      const newScale = Math.min(maxScale, Math.max(minScale, prev.scale * factor));
      if (Math.abs(newScale - prev.scale) < 1e-6) return;

      const actualFactor = newScale / prev.scale;
      const next = {
        scale: newScale,
        x: screenX - (screenX - prev.x) * actualFactor,
        y: screenY - (screenY - prev.y) * actualFactor,
      };

      applyTransform(next);
    },
    [applyTransform]
  );

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
  const alphaRef = React.useRef(1.0);

  // Smoothly center camera on a given node
  const centerOnNode = React.useCallback(
    (nodeId: string) => {
      if (!containerRef.current) return;
      const target = simNodesRef.current.find((n) => n.id === nodeId);
      if (!target) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const currentScale = transformRef.current.scale;
      applyTransform({
        ...transformRef.current,
        x: width / 2 - target.x * currentScale,
        y: height / 2 - target.y * currentScale,
      });
    },
    [applyTransform]
  );

  // 1. Initialize or update simulation data when nodes/edges change
  React.useEffect(() => {
    const existingPos = new Map<string, { x: number; y: number }>();
    for (const sn of simNodesRef.current) {
      existingPos.set(sn.id, { x: sn.x, y: sn.y });
    }

    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    const filteredNodes =
      filterType === "all" ? nodes : nodes.filter((n) => n.type === filterType);
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

    // Calculate deterministic spatial clusters for new nodes
    const deterministicPositions = computeDeterministicGraphLayout(
      filteredNodes,
      edges,
      width,
      height
    );

    // Convert to SimNodes with Obsidian-style gentle scaling (4.5px base up to ~13.5px)
    const newSimNodes: SimNode[] = filteredNodes.map((n) => {
      const prev = existingPos.get(n.id);
      const detPos = deterministicPositions.get(n.id);
      const initialX = prev ? prev.x : detPos ? detPos.x : width / 2;
      const initialY = prev ? prev.y : detPos ? detPos.y : height / 2;

      const degree = n.degree || 0;
      const baseRadius = 4.5;
      const radius = Math.min(14, Math.max(4.5, baseRadius + Math.sqrt(degree) * 1.8));

      return {
        ...n,
        x: initialX,
        y: initialY,
        vx: 0,
        vy: 0,
        radius,
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
    alphaRef.current = 1.0;
    wakeLoopRef.current(1.0);
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

    applyTransform({
      x: width / 2 - centerX * scale,
      y: height / 2 - centerY * scale,
      scale,
    });
  }, [applyTransform]);

  // Auto fit once after mount
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fitToView();
    }, 200);
    return () => clearTimeout(timer);
  }, [fitToView]);

  // Smoothly center on selected node if changed externally
  React.useEffect(() => {
    if (!selectedNodeId || !containerRef.current) return;
    const target = simNodesRef.current.find((n) => n.id === selectedNodeId);
    if (!target) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const currentScale = transformRef.current.scale;

    applyTransform({
      ...transformRef.current,
      x: width / 2 - target.x * currentScale,
      y: height / 2 - target.y * currentScale,
    });
  }, [selectedNodeId, applyTransform]);

  // 3. Force-directed physical simulation loop + render loop (with idle sleep)
  React.useEffect(() => {
    let animId: number | null = null;
    let isLoopRunning = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const activeCanvas = canvas;
    const activeCtx = ctx;

    // Obsidian-like physical force parameters: calm, organic clustering
    const repulsionStrength = 1300;
    const springLength = 85;
    const springStrength = 0.045;
    const centerStrength = 0.005;
    const damping = 0.88;

    function step() {
      const sn = simNodesRef.current;
      const se = simEdgesRef.current;
      const container = containerRef.current;
      const width = container?.clientWidth || 800;
      const height = container?.clientHeight || 600;
      const dpr = window.devicePixelRatio || 1;
      const cx = width / 2;
      const cy = height / 2;

      // Only run simulation integration while cooling alpha > 0.005
      if (alphaRef.current > 0.005) {
        const currentAlpha = alphaRef.current;

        // 1. Repulsion between nodes
        for (let i = 0; i < sn.length; i++) {
          const n1 = sn[i];
          for (let j = i + 1; j < sn.length; j++) {
            const n2 = sn[j];
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const distSq = dx * dx + dy * dy || 1;
            const dist = Math.sqrt(distSq);

            if (dist < 300) {
              const force = (repulsionStrength / distSq) * currentAlpha;
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

            // Circle collision avoidance: prevent circles from overlapping
            const minDist = n1.radius + n2.radius + 6;
            if (dist < minDist) {
              const overlap = (minDist - dist) * 0.45 * currentAlpha;
              const ox = (dx / dist) * overlap;
              const oy = (dy / dist) * overlap;
              if (!n1.isDragging) {
                n1.x -= ox;
                n1.y -= oy;
              }
              if (!n2.isDragging) {
                n2.x += ox;
                n2.y += oy;
              }
            }
          }
        }

        // 2. Spring forces along edges
        for (const e of se) {
          const dx = e.targetNode.x - e.sourceNode.x;
          const dy = e.targetNode.y - e.sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - springLength) * springStrength * currentAlpha;
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
            n.vx += (cx - n.x) * centerStrength * currentAlpha;
            n.vy += (cy - n.y) * centerStrength * currentAlpha;

            n.vx *= damping;
            n.vy *= damping;

            n.x += n.vx;
            n.y += n.vy;
          }
        }

        // Dissipate energy smoothly into stable rest
        alphaRef.current *= 0.985;
      }

      // 4. Render current frame
      render(activeCtx, width, height, dpr);

      // PERF-03: Suspend loop when physical energy cools below threshold and no user gesture is active
      const isDragging = !!draggedNodeRef.current;
      const isInteracting = isInteractingRef.current;

      if (alphaRef.current > 0.005 || isDragging || isInteracting) {
        animId = requestAnimationFrame(step);
      } else {
        isLoopRunning = false;
        animId = null;
      }
    }

    function render(c: CanvasRenderingContext2D, w: number, h: number, dpr: number) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);

      const isDark = document.documentElement.classList.contains("dark");
      const currentT = transformRef.current;

      // Subtle Background Grid
      c.save();
      c.strokeStyle = isDark ? "rgba(255, 255, 255, 0.025)" : "rgba(0, 0, 0, 0.025)";
      c.lineWidth = 1;
      let effectiveGridSize = 45 * currentT.scale;
      while (effectiveGridSize < 25) effectiveGridSize *= 2;
      while (effectiveGridSize > 100) effectiveGridSize /= 2;
      const offsetX = ((currentT.x % effectiveGridSize) + effectiveGridSize) % effectiveGridSize;
      const offsetY = ((currentT.y % effectiveGridSize) + effectiveGridSize) % effectiveGridSize;

      for (let x = offsetX; x < w; x += effectiveGridSize) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, h);
        c.stroke();
      }
      for (let y = offsetY; y < h; y += effectiveGridSize) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }
      c.restore();

      // Apply Pan & Zoom Transform (anchored in CSS pixel space)
      c.save();
      c.translate(currentT.x, currentT.y);
      c.scale(currentT.scale, currentT.scale);

      const sn = simNodesRef.current;
      const se = simEdgesRef.current;
      const selId = selectedNodeId;
      const pathNodeSet = new Set(highlightedPathNodeIds);
      const pathEdgeSet = new Set(highlightedPathEdgeIds);

      // Connected nodes set for focus mode or selection (true N-hop BFS)
      const connectedNodeIds = new Set<string>();
      if (selId) {
        connectedNodeIds.add(selId);
        const maxHops = focusDepth !== null ? Math.max(1, focusDepth) : 1;
        let frontier = new Set<string>([selId]);
        for (let hop = 0; hop < maxHops; hop++) {
          const nextFrontier = new Set<string>();
          for (const e of se) {
            if (frontier.has(e.source) && !connectedNodeIds.has(e.target)) {
              connectedNodeIds.add(e.target);
              nextFrontier.add(e.target);
            }
            if (frontier.has(e.target) && !connectedNodeIds.has(e.source)) {
              connectedNodeIds.add(e.source);
              nextFrontier.add(e.source);
            }
          }
          frontier = nextFrontier;
          if (frontier.size === 0) break;
        }
      }

      // 1. Draw Edges (Obsidian Minimalist Style: Thin, elegant lines)
      for (const e of se) {
        const isSelectedEdge = selId && (e.source === selId || e.target === selId);
        const isHoveredEdge = hoveredEdgeRef.current?.id === e.id;
        const isPathEdge = pathEdgeSet.has(e.id);
        const isConnectedToSelected = selId && connectedNodeIds.has(e.source) && connectedNodeIds.has(e.target);

        // When a node is selected, dim unrelated edges into near-invisibility
        const isDimmed =
          (selId && !isSelectedEdge && (!focusDepth || !isConnectedToSelected)) ||
          (pathNodeSet.size > 0 && !isPathEdge);

        c.save();

        if (isPathEdge) {
          c.strokeStyle = "#10b981"; // emerald glow
          c.lineWidth = Math.max(2.0, 2.6 / currentT.scale);
          c.shadowColor = "rgba(16, 185, 129, 0.6)";
          c.shadowBlur = 8;
        } else if (isHoveredEdge) {
          c.strokeStyle = isDark ? "#93c5fd" : "#3b82f6";
          c.lineWidth = Math.max(1.8, 2.2 / currentT.scale);
        } else if (isSelectedEdge) {
          c.strokeStyle = isDark ? "#60a5fa" : "#2563eb";
          c.lineWidth = Math.max(1.6, 2.0 / currentT.scale);
          c.shadowColor = "rgba(59, 130, 246, 0.35)";
          c.shadowBlur = 5;
        } else if (isDimmed) {
          c.strokeStyle = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";
          c.lineWidth = 0.8 / currentT.scale;
        } else {
          // Standard fine, elegant lines
          c.strokeStyle = isDark ? "rgba(255, 255, 255, 0.16)" : "rgba(0, 0, 0, 0.16)";
          c.lineWidth = Math.max(0.9, 1.2 / currentT.scale);
        }

        // Structural vs Explicit distinction without visual noise:
        // Structural links (subpages) use a subtle dashed line
        if (e.isStructural && !isPathEdge && !isSelectedEdge) {
          c.setLineDash([3 / currentT.scale, 3 / currentT.scale]);
          c.strokeStyle = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)";
        } else {
          c.setLineDash([]);
        }

        // Draw line
        c.beginPath();
        c.moveTo(e.sourceNode.x, e.sourceNode.y);
        c.lineTo(e.targetNode.x, e.targetNode.y);
        c.stroke();
        c.setLineDash([]);

        // Subtle directed arrow only on selected or path edges
        if ((isSelectedEdge || isPathEdge || isHoveredEdge) && !isDimmed) {
          const dx = e.targetNode.x - e.sourceNode.x;
          const dy = e.targetNode.y - e.sourceNode.y;
          const angle = Math.atan2(dy, dx);
          const dist = Math.sqrt(dx * dx + dy * dy);

          const arrowDist = dist - e.targetNode.radius - 3;
          if (arrowDist > 12) {
            const arrowX = e.sourceNode.x + Math.cos(angle) * arrowDist;
            const arrowY = e.sourceNode.y + Math.sin(angle) * arrowDist;
            const arrowSize = Math.max(4, 6 / currentT.scale);

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
        }

        // Relationship Badge: ONLY rendered on hovered edge or active path
        if (isHoveredEdge || isPathEdge) {
          const midX = (e.sourceNode.x + e.targetNode.x) / 2;
          const midY = (e.sourceNode.y + e.targetNode.y) / 2;

          c.save();
          const fontSize = Math.max(9, Math.min(12, 10 / currentT.scale));
          c.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          c.textAlign = "center";
          c.textBaseline = "middle";

          const textMetrics = c.measureText(e.label);
          const bgPaddingX = 5 / currentT.scale;
          const bgPaddingY = 2 / currentT.scale;
          const pillW = textMetrics.width + bgPaddingX * 2;
          const pillH = fontSize + bgPaddingY * 2;

          c.beginPath();
          if (typeof c.roundRect === "function") {
            c.roundRect(midX - pillW / 2, midY - pillH / 2, pillW, pillH, 3 / currentT.scale);
          } else {
            c.rect(midX - pillW / 2, midY - pillH / 2, pillW, pillH);
          }
          c.fillStyle = isPathEdge
            ? "#064e3b"
            : isDark
            ? "rgba(24, 24, 27, 0.94)"
            : "rgba(255, 255, 255, 0.96)";
          c.fill();

          c.lineWidth = 1 / currentT.scale;
          c.strokeStyle = isPathEdge
            ? "#10b981"
            : isDark
            ? "rgba(255, 255, 255, 0.2)"
            : "rgba(0, 0, 0, 0.2)";
          c.stroke();

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

      // 2. Draw Nodes (Pure Obsidian Minimalist Circles)
      for (const n of sn) {
        const isSelected = n.id === selId;
        const isHovered = hoveredNodeRef.current?.id === n.id;
        const isPathNode = pathNodeSet.has(n.id);
        const isDirectNeighbor = selId && connectedNodeIds.has(n.id);

        const isDimmed =
          (selId && !isSelected && !isDirectNeighbor) ||
          (pathNodeSet.size > 0 && !isPathNode);

        const style = ENTITY_STYLES[n.type] || ENTITY_STYLES.page;

        c.save();

        if (isDimmed) {
          c.globalAlpha = 0.18;
        }

        // A. Subtle Selection or Path Glow Ring
        if (isSelected || isPathNode) {
          c.save();
          c.beginPath();
          c.arc(n.x, n.y, n.radius + (isSelected ? 3.5 : 2.5) / currentT.scale, 0, Math.PI * 2);
          c.fillStyle = isPathNode
            ? "rgba(16, 185, 129, 0.25)"
            : isDark
            ? "rgba(96, 165, 250, 0.28)"
            : "rgba(37, 99, 235, 0.22)";
          c.fill();
          c.restore();
        } else if (isHovered) {
          c.save();
          c.beginPath();
          c.arc(n.x, n.y, n.radius + 3 / currentT.scale, 0, Math.PI * 2);
          c.fillStyle = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
          c.fill();
          c.restore();
        }

        // B. Node Circle Fill
        c.beginPath();
        c.arc(n.x, n.y, n.radius, 0, Math.PI * 2);

        if (isPathNode) {
          c.fillStyle = "#10b981";
        } else if (isSelected) {
          c.fillStyle = isDark ? "#60a5fa" : "#2563eb";
        } else {
          c.fillStyle = style.color;
        }
        c.fill();

        // C. Circle Border (Crisp and subtle)
        c.lineWidth = Math.max(1, 1.2 / currentT.scale);
        c.strokeStyle = isSelected
          ? "#ffffff"
          : isPathNode
          ? "#a7f3d0"
          : isDark
          ? "rgba(255, 255, 255, 0.25)"
          : "rgba(0, 0, 0, 0.15)";
        c.stroke();

        // D. Obsidian Typography: Labels only on Hover, Selected, Path, or Direct Neighbors of Selected Node
        const showLabel = isHovered || isSelected || isPathNode || (selId && isDirectNeighbor) || currentT.scale >= 1.6;

        if (showLabel) {
          const fontSize = Math.max(10, Math.min(13, 11 / currentT.scale));
          c.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          c.textAlign = "center";
          c.textBaseline = "top";

          const label = n.title.length > 32 ? n.title.slice(0, 30) + "…" : n.title;
          const labelY = n.y + n.radius + 4 / currentT.scale;

          // Crisp text outline for legibility over lines without any card box
          c.lineJoin = "round";
          c.miterLimit = 2;
          c.strokeStyle = isDark ? "rgba(9, 9, 11, 0.9)" : "rgba(255, 255, 255, 0.95)";
          c.lineWidth = 3 / currentT.scale;
          c.strokeText(label, n.x, labelY);

          c.fillStyle = isSelected
            ? (isDark ? "#93c5fd" : "#1d4ed8")
            : isPathNode
            ? (isDark ? "#6ee7b7" : "#047857")
            : (isDark ? "#f1f5f9" : "#0f172a");
          c.fillText(label, n.x, labelY);
        }

        c.restore();
      }

      c.restore();
    }

    const wakeLoop = (minAlpha?: number) => {
      if (minAlpha !== undefined && alphaRef.current < minAlpha) {
        alphaRef.current = minAlpha;
      }
      if (!isLoopRunning) {
        isLoopRunning = true;
        animId = requestAnimationFrame(step);
      }
    };

    wakeLoopRef.current = wakeLoop;
    wakeLoop(1.0);

    return () => {
      if (animId !== null) {
        cancelAnimationFrame(animId);
      }
      isLoopRunning = false;
    };
  }, [selectedNodeId, focusDepth, highlightedPathNodeIds, highlightedPathEdgeIds]);

  // Handle Resize for High-DPI Canvas with ResizeObserver
  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    function handleResize() {
      if (!container || !canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;

      const targetW = Math.round(width * dpr);
      const targetH = Math.round(height * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        wakeLoopRef.current();
      }
    }

    handleResize();
    const observer = new ResizeObserver(() => handleResize());
    observer.observe(container);
    window.addEventListener("resize", handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
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
      const currentScale = transformRef.current.scale;
      for (let i = sn.length - 1; i >= 0; i--) {
        const n = sn[i];
        const dx = n.x - canvasX;
        const dy = n.y - canvasY;
        // Minimum hit radius of 10px ensures small circles are easy to select
        const hitRadius = Math.max(n.radius, 10 / currentScale);
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          return n;
        }
      }
      return null;
    },
    []
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    wakeLoopRef.current();
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
    wakeLoopRef.current();
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
      alphaRef.current = 0.4;
      wakeLoopRef.current(0.4);
    } else if (isInteractingRef.current) {
      applyTransform({
        ...transformRef.current,
        x: transformRef.current.x + dx,
        y: transformRef.current.y + dy,
      });
    }

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    wakeLoopRef.current();
    if (draggedNodeRef.current) {
      draggedNodeRef.current.isDragging = false;
      draggedNodeRef.current = null;
    }
    isInteractingRef.current = false;
    lastMousePosRef.current = null;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const hitNode = getNodeAtPoint(x, y);
    if (hitNode && onOpenNode) {
      onOpenNode(hitNode);
    }
  };

  // Native non-passive Wheel & Gesture listener
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();

      const container = containerRef.current;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let dx = e.deltaX;
      let dy = e.deltaY;
      if (e.deltaMode === 1) {
        // DOM_DELTA_LINE (Firefox physical mouse wheel)
        dx *= 33;
        dy *= 33;
      } else if (e.deltaMode === 2 && container) {
        // DOM_DELTA_PAGE
        dx *= container.clientWidth;
        dy *= container.clientHeight;
      }

      // 1. Trackpad pinch-to-zoom or Ctrl + Mouse Wheel zoom
      if (e.ctrlKey) {
        const factor = Math.min(1.25, Math.max(0.8, Math.exp(-dy * 0.008)));
        zoomAtPoint(mouseX, mouseY, factor);
        return;
      }

      // 2. Shift + Wheel horizontal pan
      if (e.shiftKey) {
        const panX = dx !== 0 ? dx : dy;
        applyTransform({
          ...transformRef.current,
          x: transformRef.current.x - panX,
        });
        return;
      }

      // 3. Trackpad 2-finger pan vs Mouse wheel zoom
      // Trackpads emit 2D pixel deltas with dx !== 0 or micro-steps (Math.abs(dy) < 50 && dy % 1 !== 0)
      const isTrackpadPan =
        e.deltaMode === 0 &&
        (Math.abs(dx) > 0 || (Math.abs(dy) < 50 && dy % 1 !== 0));

      if (isTrackpadPan && Math.abs(dx) > 0) {
        applyTransform({
          ...transformRef.current,
          x: transformRef.current.x - dx,
          y: transformRef.current.y - dy,
        });
      } else {
        // Smooth exponential zoom proportional to dy, pinned at mouse cursor
        const factor = Math.min(1.25, Math.max(0.8, Math.exp(-dy * 0.0018)));
        zoomAtPoint(mouseX, mouseY, factor);
      }
    };

    canvas.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onNativeWheel);
  }, [applyTransform, zoomAtPoint]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full overflow-hidden select-none bg-background",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        className="block w-full h-full touch-none"
      />

      {/* Lightweight Hover Card Tooltip */}
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
              <strong className="text-foreground">{hoverState.node.degree}</strong> conexões
            </span>
            <span>•</span>
            <span>{hoverState.node.outDegree} saída</span>
            <span>•</span>
            <span>{hoverState.node.inDegree} entrada</span>
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

      {/* Floating Contextual Exploration HUD (Active when a node is selected) */}
      {selectedNode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-xl z-20 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-1.5 pr-2.5 border-r border-border min-w-0">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: ENTITY_STYLES[selectedNode.type]?.color || "#3b82f6" }}
            />
            <span className="font-semibold text-foreground truncate max-w-[130px] sm:max-w-[200px]">
              {selectedNode.title}
            </span>
            <span className="text-[10px] uppercase font-bold text-muted-foreground px-1 py-0.2 rounded bg-muted shrink-0">
              {selectedNode.type}
            </span>
          </div>

          {/* Hop neighborhood selector */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground hidden sm:inline font-medium">
              Vizinhança:
            </span>
            {[1, 2, 3].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onSetFocusDepth?.(focusDepth === d ? null : d)}
                className={cn(
                  "px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors",
                  focusDepth === d
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title={`Explorar vizinhança a ${d} salto${d > 1 ? "s" : ""}`}
              >
                {d}h
              </button>
            ))}
            <button
              type="button"
              onClick={() => onSetFocusDepth?.(null)}
              className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors",
                focusDepth === null
                  ? "bg-[#242427] text-foreground border border-[#29292D] shadow-xs"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title="Mostrar todo o grafo sem esmaecer nós distantes"
            >
              Tudo
            </button>
          </div>

          <div className="h-3.5 w-px bg-border mx-0.5" />

          {/* Quick Center camera */}
          <button
            type="button"
            onClick={() => centerOnNode(selectedNode.id)}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Centrar câmara neste elemento"
          >
            <Target className="h-3.5 w-3.5" />
          </button>

          {/* Reset selection / Back to global view */}
          <button
            type="button"
            onClick={() => {
              onSelectNode(null);
              onSetFocusDepth?.(null);
            }}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Desmarcar elemento e regressar à visão geral"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Floating Canvas Controls (Fit, Zoom In, Zoom Out) */}
      <div className="absolute bottom-5 right-5 flex items-center gap-1.5 p-1 rounded-xl bg-background/90 backdrop-blur-md border border-border shadow-md">
        <button
          type="button"
          onClick={() => {
            const container = containerRef.current;
            const cx = (container?.clientWidth || 800) / 2;
            const cy = (container?.clientHeight || 600) / 2;
            zoomAtPoint(cx, cy, 1.25);
          }}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            const container = containerRef.current;
            const cx = (container?.clientWidth || 800) / 2;
            const cy = (container?.clientHeight || 600) / 2;
            zoomAtPoint(cx, cy, 0.8);
          }}
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
          title="Ajustar grafo ao ecrã"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Obsidian Minimalist Entity Legend Pill */}
      <div className="absolute bottom-5 left-5 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-background/90 backdrop-blur-md border border-border shadow-xs text-[11px] text-muted-foreground">
        {(["page", "project", "task", "decision", "meeting", "goal"] as const).map(
          (t) => {
            const st = ENTITY_STYLES[t];
            return (
              <span key={t} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: st.color }}
                />
                <span>{st.label}</span>
              </span>
            );
          }
        )}
      </div>
    </div>
  );
}
