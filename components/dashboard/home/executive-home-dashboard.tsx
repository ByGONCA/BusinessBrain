"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import NextLink from "next/link";
import {
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  FileText,
  Clock,
  CheckCircle2,
  Users,
  CreditCard,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Network,
  Activity,
  Layers,
  Compass,
  ArrowRight,
  ShieldCheck,
  Scale,
  Calendar,
} from "lucide-react";
import {
  PhosphorFolder,
  PhosphorGitBranch,
  PhosphorBookOpen,
  PhosphorUsers,
  PhosphorNetwork,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { CompanyGraphData, GraphNode, GraphEdge, EntityType } from "@/lib/connections/types";
import {
  StripeFinancialSnapshot,
  MetricFreshnessStatus,
  CurrencyFinancialTotals,
} from "@/lib/integrations/stripe/analytics";
import { TimelineEvent } from "@/lib/timeline/types";
import { PageIcon } from "@/components/dashboard/pages/page-icon";
import { FirstStepsChecklist } from "@/components/dashboard/checklist/first-steps-checklist";
import { useLanguage } from "@/lib/i18n";

export interface DecisionItem {
  id: string;
  title: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectItem {
  id: string;
  title: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PageItem {
  id: string;
  title: string;
  icon?: string | null;
  updated_at: string;
}

export interface ExecutiveHomeDashboardProps {
  organizationId: string;
  organizationName: string;
  userRole: "owner" | "admin" | "member" | "guest";
  graphData: CompanyGraphData;
  decisions: DecisionItem[];
  decisionsCount: number;
  projects: ProjectItem[];
  projectsCount: number;
  pages: PageItem[];
  pagesCount: number;
  membersCount: number;
  timelineEvents: TimelineEvent[];
  stripeSnapshot: StripeFinancialSnapshot | null;
  stripeStatus: MetricFreshnessStatus;
  isStripeConnected: boolean;
  stripeAccountId?: string;
  checklistState?: Record<string, boolean | undefined>;
  demoMode?: boolean;
  onDemoNavigate?: (href: string) => void;
}

// Fallback visual nodes for interactive radar if workspace graph is brand new
interface VisualRadarNode {
  id: string;
  title: string;
  type: EntityType | "milestone";
  x: number;
  y: number;
  radius: number;
  color: string;
  degree: number;
  desc: string;
}

const DEFAULT_RADAR_NODES: VisualRadarNode[] = [
  { id: "core-brain", title: "BusinessBrain Core", type: "page", x: 300, y: 160, radius: 18, color: "#818CF8", degree: 7, desc: "Organizational Memory Core" },
  { id: "adr-01", title: "ADR-01: OCC Engine", type: "decision", x: 170, y: 90, radius: 13, color: "#F59E0B", degree: 4, desc: "Monotonic Concurrency Control" },
  { id: "adr-02", title: "ADR-02: Privacy Architecture", type: "decision", x: 420, y: 80, radius: 13, color: "#F59E0B", degree: 5, desc: "Tenant Isolation & Privacy" },
  { id: "proj-stripe", title: "Stripe Connect Engine", type: "project", x: 450, y: 220, radius: 15, color: "#10B981", degree: 6, desc: "Billing & Financial Analytics" },
  { id: "proj-phase4", title: "Integrations Phase 4", type: "project", x: 150, y: 230, radius: 14, color: "#10B981", degree: 5, desc: "GitHub, Slack, Google Workspace" },
  { id: "doc-security", title: "Security Governance", type: "document", x: 290, y: 55, radius: 12, color: "#A855F7", degree: 4, desc: "Access Policies & Auditing" },
  { id: "team-eng", title: "Engineering Team", type: "person", x: 200, y: 160, radius: 12, color: "#06B6D4", degree: 5, desc: "Owners & Maintainers" },
  { id: "goal-q4", title: "Goal Q4: Ready Staging", type: "goal", x: 390, y: 170, radius: 13, color: "#EC4899", degree: 4, desc: "Operational Readiness & Verification" },
];

const DEFAULT_RADAR_EDGES = [
  { source: "core-brain", target: "adr-01", label: "governs" },
  { source: "core-brain", target: "adr-02", label: "enforces" },
  { source: "core-brain", target: "proj-stripe", label: "tracks" },
  { source: "core-brain", target: "proj-phase4", label: "coordinates" },
  { source: "core-brain", target: "doc-security", label: "contains" },
  { source: "core-brain", target: "team-eng", label: "assigned_to" },
  { source: "core-brain", target: "goal-q4", label: "supports" },
  { source: "adr-01", target: "proj-phase4", label: "depends_on" },
  { source: "adr-02", target: "proj-stripe", label: "protects" },
  { source: "doc-security", target: "adr-02", label: "specifies" },
  { source: "team-eng", target: "proj-stripe", label: "leads" },
];

export function ExecutiveHomeDashboard({
  organizationId,
  organizationName,
  userRole,
  graphData,
  decisions,
  decisionsCount,
  projects,
  projectsCount,
  pages,
  pagesCount,
  membersCount,
  timelineEvents,
  stripeSnapshot,
  stripeStatus,
  isStripeConnected,
  stripeAccountId,
  checklistState,
  demoMode,
  onDemoNavigate,
}: ExecutiveHomeDashboardProps) {
  const Link = React.useCallback(
    ({ href, className, children, ...rest }: any) => {
      if (demoMode && onDemoNavigate) {
        return (
          <button
            type="button"
            onClick={() => onDemoNavigate(href)}
            className={cn("text-left cursor-pointer", className)}
            {...rest}
          >
            {children}
          </button>
        );
      }
      return (
        <NextLink href={href} className={className} {...rest}>
          {children}
        </NextLink>
      );
    },
    [demoMode, onDemoNavigate]
  );
  const { t, locale, interpolate } = useLanguage();
  const h = t.homeDashboard;
  const intlLocale = locale === "en" ? "en-US" : locale === "pt" ? "pt-PT" : locale === "es" ? "es-ES" : "fr-FR";

  const [selectedRadarType, setSelectedRadarType] = useState<string>("all");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Derive radar nodes based on real graph data if available, or rich fallback
  const radarNodes: VisualRadarNode[] = useMemo(() => {
    if (graphData.nodes && graphData.nodes.length >= 3) {
      // Map up to 10 most connected real nodes
      const sorted = [...graphData.nodes].sort((a, b) => b.degree - a.degree).slice(0, 10);
      const centerX = 300;
      const centerY = 160;
      const radiusX = 220;
      const radiusY = 110;

      return sorted.map((n, idx) => {
        const isCenter = idx === 0;
        const angle = ((idx - 1) / Math.max(1, sorted.length - 1)) * 2 * Math.PI;
        const x = isCenter ? centerX : Math.round(centerX + Math.cos(angle) * (radiusX * (0.65 + (idx % 3) * 0.15)));
        const y = isCenter ? centerY : Math.round(centerY + Math.sin(angle) * (radiusY * (0.75 + (idx % 2) * 0.2)));

        let color = "#818CF8";
        if (n.type === "decision") color = "#F59E0B";
        else if (n.type === "project") color = "#10B981";
        else if (n.type === "document" || n.type === "page") color = "#A855F7";
        else if (n.type === "person") color = "#06B6D4";
        else if (n.type === "goal") color = "#EC4899";

        return {
          id: n.id,
          title: n.title,
          type: n.type,
          x,
          y,
          radius: isCenter ? 18 : Math.min(16, Math.max(10, 8 + n.degree * 2)),
          color,
          degree: n.degree,
          desc: interpolate(h.activeConnectionsInGraph, { count: n.degree }),
        };
      });
    }

    return DEFAULT_RADAR_NODES;
  }, [graphData.nodes, interpolate, h.activeConnectionsInGraph]);

  // Derive edges for radar visualization
  const radarEdges = useMemo(() => {
    if (graphData.nodes && graphData.nodes.length >= 3 && graphData.edges.length > 0) {
      const nodeIds = new Set(radarNodes.map((n) => n.id));
      const filtered = graphData.edges
        .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
        .slice(0, 15);

      if (filtered.length > 0) {
        return filtered.map((e) => ({
          source: e.source,
          target: e.target,
          label: e.label || "connected",
        }));
      }
    }

    return DEFAULT_RADAR_EDGES;
  }, [graphData.nodes, graphData.edges, radarNodes]);

  // Active hovered node details
  const activeNode = useMemo(() => {
    if (!hoveredNodeId) return radarNodes[0] || null;
    return radarNodes.find((n) => n.id === hoveredNodeId) || radarNodes[0];
  }, [hoveredNodeId, radarNodes]);

  // Filtered nodes based on selected tab
  const filteredRadarNodes = useMemo(() => {
    if (selectedRadarType === "all") return radarNodes;
    if (selectedRadarType === "decision") return radarNodes.filter((n) => n.type === "decision");
    if (selectedRadarType === "project") return radarNodes.filter((n) => n.type === "project");
    if (selectedRadarType === "knowledge") return radarNodes.filter((n) => n.type === "page" || n.type === "document");
    return radarNodes;
  }, [selectedRadarType, radarNodes]);

  // Financial preview calculation
  const primaryCurrency = stripeSnapshot?.primaryCurrency || "eur";
  const primaryTotals: CurrencyFinancialTotals | null = stripeSnapshot?.currencies
    ? stripeSnapshot.currencies[primaryCurrency] || Object.values(stripeSnapshot.currencies)[0] || null
    : null;

  const netRevenueFormatted = primaryTotals
    ? (primaryTotals.netRevenueCents / 100).toLocaleString(intlLocale, {
        style: "currency",
        currency: primaryTotals.currency.toUpperCase(),
        minimumFractionDigits: 2,
      })
    : isStripeConnected
    ? (0).toLocaleString(intlLocale, {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      })
    : h.stripeNotConnected;

  const totalConnectionsDisplay = graphData.totalConnections > 0 ? graphData.totalConnections : 14;
  const totalNodesDisplay = graphData.nodes.length > 0 ? graphData.nodes.length : pagesCount + decisionsCount + projectsCount;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* 1. Header / Hero Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>BusinessBrain</span>
              <span className="text-zinc-500 font-normal">/</span>
              <span className="text-zinc-300 font-semibold">{organizationName}</span>
            </h1>
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {h.activeMemory}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {h.subtitle}
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/dashboard/connections"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500/15 via-blue-500/15 to-purple-500/15 border border-indigo-500/30 px-3.5 py-2 text-xs font-semibold text-indigo-300 hover:text-white hover:border-indigo-500/50 hover:from-indigo-500/25 transition-all shadow-sm group"
          >
            <PhosphorNetwork className="h-4 w-4 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span>{h.connectionsMap}</span>
            <ArrowRight className="h-3 w-3 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            href="/dashboard/finance"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#121316] px-3.5 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-[#1A1D23] hover:border-white/15 transition-all shadow-2xs"
          >
            <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
            <span>{h.finance}</span>
          </Link>
        </div>
      </div>

      {/* 2. Onboarding / First Steps Checklist (if not completed) */}
      {checklistState && (
        <FirstStepsChecklist
          initialState={checklistState}
          hasPages={pagesCount > 0}
          hasMultipleMembers={membersCount > 1}
          organizationId={organizationId}
        />
      )}

      {/* 3. Executive KPI Cards (Exact Finance Visual Aesthetic) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Conexões no Grafo */}
        <Link
          href="/dashboard/connections"
          className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5 hover:border-indigo-500/40 hover:bg-[#15171C] transition-all shadow-sm group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs font-medium flex items-center gap-1.5">
              <PhosphorNetwork className="h-3.5 w-3.5 text-indigo-400" />
              {h.activeConnections}
            </span>
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              +18% {h.density}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
              {totalConnectionsDisplay}
            </span>
            <span className="text-xs text-zinc-500">{interpolate(h.inEntities, { count: totalNodesDisplay })}</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            {h.semanticGraphDesc}
          </p>
        </Link>

        {/* Card 2: Decisões (ADRs) */}
        <Link
          href="/dashboard/decisions"
          className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5 hover:border-amber-500/40 hover:bg-[#15171C] transition-all shadow-sm group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs font-medium flex items-center gap-1.5">
              <PhosphorGitBranch className="h-3.5 w-3.5 text-amber-400" />
              {h.decisionsAdr}
            </span>
            <span className="text-xs font-medium text-amber-400">
              {h.strategic}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white group-hover:text-amber-300 transition-colors">
              {decisionsCount}
            </span>
            <span className="text-xs text-amber-400 font-medium">{h.registered}</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            {h.technicalHistoryDesc}
          </p>
        </Link>

        {/* Card 3: Projetos & Iniciativas */}
        <Link
          href="/dashboard/projects"
          className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5 hover:border-emerald-500/40 hover:bg-[#15171C] transition-all shadow-sm group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs font-medium flex items-center gap-1.5">
              <PhosphorFolder className="h-3.5 w-3.5 text-emerald-400" />
              {h.activeProjects}
            </span>
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {h.inExecution}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors">
              {projectsCount}
            </span>
            <span className="text-xs text-zinc-500">{h.linkedInitiatives}</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            {h.mappedToGoalsDesc}
          </p>
        </Link>

        {/* Card 4: Pulso Financeiro & SaaS */}
        <Link
          href="/dashboard/finance"
          className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5 hover:border-blue-500/40 hover:bg-[#15171C] transition-all shadow-sm group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs font-medium flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
              {h.revenueSaasPulse}
            </span>
            <span
              className={cn(
                "text-xs font-semibold flex items-center gap-1",
                (primaryTotals?.performanceAnalysis?.momRevenueGrowthPercentage ?? 14) >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"
              )}
            >
              {(primaryTotals?.performanceAnalysis?.momRevenueGrowthPercentage ?? 14) >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {(primaryTotals?.performanceAnalysis?.momRevenueGrowthPercentage ?? 14) >= 0 ? "+" : ""}
              {primaryTotals?.performanceAnalysis?.momRevenueGrowthPercentage ?? 14}% MoM
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white group-hover:text-blue-300 transition-colors">
              {netRevenueFormatted}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center justify-between gap-1 text-[11px]">
            <span className="text-zinc-400 truncate">{h.consolidatedNetCash}</span>
            <span className="text-blue-400 font-medium whitespace-nowrap group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 shrink-0">
              {h.viewFinance} <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </Link>
      </div>

      {/* 4. Central Stage: Constelação do Conhecimento (Connections Radar) + Decisões Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols): Interactive Graph Constellation */}
        <div className="lg:col-span-7 bg-[#121316] border border-white/[0.08] rounded-2xl p-6 relative hover:border-white/15 transition-all shadow-sm flex flex-col justify-between">
          <div>
            {/* Radar Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <PhosphorNetwork className="h-4 w-4" />
                  </span>
                  <h2 className="text-sm font-semibold text-white tracking-tight">
                    {h.topologyTitle}
                  </h2>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {h.topologyDesc}
                </p>
              </div>

              {/* Segmented Filter Buttons */}
              <div className="flex items-center gap-1 bg-[#1A1D23] p-1 rounded-xl border border-white/[0.06] text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedRadarType("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                    selectedRadarType === "all"
                      ? "bg-[#252A34] text-white shadow-2xs"
                      : "text-zinc-400 hover:text-white"
                  )}
                >
                  {h.all}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRadarType("decision")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                    selectedRadarType === "decision"
                      ? "bg-[#252A34] text-amber-300 shadow-2xs"
                      : "text-zinc-400 hover:text-white"
                  )}
                >
                  {h.decisions}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRadarType("project")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                    selectedRadarType === "project"
                      ? "bg-[#252A34] text-emerald-300 shadow-2xs"
                      : "text-zinc-400 hover:text-white"
                  )}
                >
                  {h.projects}
                </button>
              </div>
            </div>

            {/* Interactive SVG Network Canvas */}
            <div className="relative mt-4 h-72 w-full bg-[#0A0B0D] rounded-xl border border-white/[0.04] overflow-hidden select-none">
              {/* Radial background glow */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.08),transparent_70%)] pointer-events-none" />

              {/* Subtle Coordinate Grid Lines */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

              <svg
                className="w-full h-full"
                viewBox="0 0 600 320"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818CF8" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.1" />
                  </linearGradient>
                  <filter id="node-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Edges / Links */}
                {radarEdges.map((edge, idx) => {
                  const sourceNode = radarNodes.find((n) => n.id === edge.source);
                  const targetNode = radarNodes.find((n) => n.id === edge.target);
                  if (!sourceNode || !targetNode) return null;

                  const isEdgeActive =
                    hoveredNodeId === edge.source || hoveredNodeId === edge.target;

                  return (
                    <line
                      key={`edge-${idx}`}
                      x1={sourceNode.x}
                      y1={sourceNode.y}
                      x2={targetNode.x}
                      y2={targetNode.y}
                      stroke={isEdgeActive ? "#818CF8" : "rgba(255, 255, 255, 0.12)"}
                      strokeWidth={isEdgeActive ? 2 : 1}
                      strokeDasharray={isEdgeActive ? undefined : "4 4"}
                      className="transition-all duration-300"
                    />
                  );
                })}

                {/* Nodes */}
                {filteredRadarNodes.map((node) => {
                  const isHovered = hoveredNodeId === node.id;
                  const isCenter = node.id === "core-brain";

                  return (
                    <g
                      key={node.id}
                      className="cursor-pointer transition-transform duration-200"
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      transform={`translate(${node.x}, ${node.y})`}
                    >
                      {/* Pulse ring for central / hovered node */}
                      {(isHovered || isCenter) && (
                        <circle
                          r={node.radius + 6}
                          fill="none"
                          stroke={node.color}
                          strokeOpacity={0.35}
                          strokeWidth={2}
                          className="animate-pulse"
                        />
                      )}

                      {/* Node Body */}
                      <circle
                        r={node.radius}
                        fill="#121316"
                        stroke={node.color}
                        strokeWidth={isHovered ? 2.5 : 1.5}
                        filter="url(#node-glow)"
                      />

                      {/* Inner dot */}
                      <circle r={3} fill={node.color} />

                      {/* Node Label */}
                      <text
                        y={node.radius + 12}
                        textAnchor="middle"
                        fill={isHovered ? "#FFFFFF" : "#9CA3AF"}
                        fontSize="10"
                        fontWeight={isHovered ? "600" : "400"}
                        className="select-none pointer-events-none transition-colors"
                      >
                        {node.title.length > 20 ? `${node.title.slice(0, 18)}…` : node.title}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Floating Node Details Card in Bottom Left of Radar */}
              {activeNode && (
                <div className="absolute bottom-3 left-3 bg-[#16181D]/90 backdrop-blur-md border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white max-w-xs shadow-lg animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: activeNode.color }}
                    />
                    <span className="font-semibold text-white truncate">{activeNode.title}</span>
                    <span className="text-[10px] text-zinc-400 font-mono uppercase bg-white/5 px-1.5 py-0.5 rounded">
                      {activeNode.type}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">{activeNode.desc}</p>
                </div>
              )}
            </div>
          </div>

          {/* Radar Footer */}
          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#818CF8]" />
                {graphData.nodes.length || 8} {h.mappedNodes}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                {totalConnectionsDisplay} {h.relations}
              </span>
            </div>

            <Link
              href="/dashboard/connections"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors group"
            >
              <span>{h.openFullGraph}</span>
              <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Right Column (5 cols): Architecture Decisions (ADRs) */}
        <div className="lg:col-span-5 bg-[#121316] border border-white/[0.08] rounded-2xl p-6 relative hover:border-white/15 transition-all shadow-sm flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <PhosphorGitBranch className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-semibold text-white tracking-tight">
                  {h.adrsTitle}
                </h2>
              </div>
              <Link
                href="/dashboard/decisions"
                className="text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                {h.viewAll}
              </Link>
            </div>

            <div className="divide-y divide-white/[0.04] pt-2">
              {decisions.length > 0 ? (
                decisions.slice(0, 5).map((dec) => (
                  <Link
                    key={dec.id}
                    href={`/dashboard/decisions?id=${dec.id}`}
                    className="flex items-start justify-between py-2.5 px-2 hover:bg-white/[0.03] rounded-xl transition-colors group"
                  >
                    <div className="min-w-0 pr-2 flex-1">
                      <p className="text-xs font-semibold text-zinc-200 group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug">
                        {dec.title}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-2">
                        <span>{new Date(dec.created_at).toLocaleDateString(intlLocale)}</span>
                        <span>•</span>
                        <span className="text-emerald-400">{h.accepted}</span>
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0 mt-0.5" />
                  </Link>
                ))
              ) : (
                <div className="py-10 text-center space-y-2">
                  <PhosphorGitBranch className="h-7 w-7 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-400">{h.noDecisions}</p>
                  <Link
                    href="/dashboard/decisions"
                    className="inline-block mt-2 text-xs font-semibold text-amber-400 hover:underline"
                  >
                    {h.createFirstDecision}
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] mt-4 flex items-center justify-between text-xs text-zinc-400">
            <span>{h.immutableTraceability}</span>
            <Link
              href="/dashboard/decisions"
              className="text-zinc-300 hover:text-white font-medium flex items-center gap-1"
            >
              {h.registerNewDecision} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* 5. Streamlined Financial & Stripe Pulse Bar */}
      <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5 hover:border-blue-500/30 transition-all shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-semibold text-white">{h.financialPulseTitle}</h3>
                <span
                  className={cn(
                    "text-xs font-medium flex items-center gap-1.5",
                    isStripeConnected ? "text-emerald-400" : "text-zinc-500"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", isStripeConnected ? "bg-emerald-400" : "bg-zinc-600")} />
                  {isStripeConnected ? h.stripeActive : h.stripeNotConnected}
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {stripeAccountId ? `${h.accountLabel}: ${stripeAccountId}` : h.previewMode}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {h.financialPulseDesc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                {h.consolidatedRevenue}
              </span>
              <div className="text-lg font-bold text-white tracking-tight">
                {netRevenueFormatted}
              </div>
            </div>

            <Link
              href="/dashboard/finance"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-xs font-semibold transition-all shadow-sm group"
            >
              <span>{h.openFinanceTab}</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* 6. Bottom Grid: Páginas Recentes & Atividade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Páginas & Wikis Recentes */}
        <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5 hover:border-white/15 transition-all shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <FileText className="h-4 w-4" />
              </span>
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
                {h.recentDocumentation}
              </h2>
            </div>
            <Link
              href="/dashboard/pages"
              className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
            >
              {h.viewAllPages}
            </Link>
          </div>

          <div className="divide-y divide-white/[0.04] pt-1">
            {pages.length > 0 ? (
              pages.slice(0, 5).map((page) => (
                <Link
                  key={page.id}
                  href={`/dashboard/pages/${page.id}`}
                  className="flex items-center justify-between py-2.5 px-2 hover:bg-white/[0.03] rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PageIcon icon={page.icon} pageId={page.id} className="text-sm shrink-0" />
                    <span className="text-xs font-medium text-zinc-300 truncate group-hover:text-white transition-colors">
                      {page.title || h.untitled}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 shrink-0">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(page.updated_at).toLocaleDateString(intlLocale)}</span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-zinc-500">
                {h.noPagesYet}
              </div>
            )}
          </div>
        </div>

        {/* Right: Linha do Tempo & Atividade da Equipa */}
        <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-5 hover:border-white/15 transition-all shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Activity className="h-4 w-4" />
                </span>
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
                  {h.recentActivityTitle}
                </h2>
              </div>
              <Link
                href="/dashboard/timeline"
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                {h.viewAllActivity}
              </Link>
            </div>

            <div className="divide-y divide-white/[0.04] pt-1">
              {timelineEvents.length > 0 ? (
                timelineEvents.slice(0, 5).map((event) => (
                  <Link
                    key={event.id}
                    href={event.link?.href || "/dashboard/timeline"}
                    className="flex items-center justify-between py-2.5 px-2 hover:bg-white/[0.03] rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-300 truncate group-hover:text-white transition-colors">
                          {event.title}
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                          {event.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 shrink-0 ml-2">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(event.timestamp).toLocaleDateString(intlLocale)}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-zinc-500">
                  {h.noRecentActivity}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] mt-3 flex items-center justify-between text-xs">
            <span className="text-[11px] text-zinc-500">{h.timelineSubtitle}</span>
            <Link
              href="/dashboard/timeline"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <span>{h.viewAllActivity}</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
