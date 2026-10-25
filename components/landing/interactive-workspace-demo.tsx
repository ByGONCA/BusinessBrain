"use client";

import * as React from "react";
import {
  DEMO_PAGES,
  DEMO_DECISIONS,
  DEMO_GRAPH_NODES,
  DEMO_FINANCE_DATA,
  DEMO_TELEMETRY,
  DemoPage,
  DemoDecision,
  DemoGraphNode,
} from "@/lib/marketing/demo-data";
import {
  FileText,
  Scale,
  Share2,
  DollarSign,
  GitBranch,
  Search,
  ArrowLeft,
  Clock,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Check,
  X,
} from "lucide-react";

export type DemoSection = "pages" | "decisions" | "graph" | "finance" | "integrations";

interface InteractiveWorkspaceDemoProps {
  initialSection?: DemoSection;
  className?: string;
}

export function InteractiveWorkspaceDemo({
  initialSection = "pages",
  className = "",
}: InteractiveWorkspaceDemoProps) {
  const [activeSection, setActiveSection] = React.useState<DemoSection>(initialSection);
  const [selectedPageId, setSelectedPageId] = React.useState<string | null>("page-strategy");
  const [selectedDecisionId, setSelectedDecisionId] = React.useState<string | null>(null);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = React.useState<string>("node-adr-014");
  const [financePeriod, setFinancePeriod] = React.useState<"30d" | "q3" | "ytd">("30d");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Keyboard shortcut: Escape returns to list from detail view
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedPageId) setSelectedPageId(null);
        if (selectedDecisionId) setSelectedDecisionId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPageId, selectedDecisionId]);

  // Filtered lists based on search query
  const filteredPages = DEMO_PAGES.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.snippet.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDecisions = DEMO_DECISIONS.filter(
    (d) =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.context.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activePage = DEMO_PAGES.find((p) => p.id === selectedPageId);
  const activeDecision = DEMO_DECISIONS.find((d) => d.id === selectedDecisionId);
  const activeGraphNode =
    DEMO_GRAPH_NODES.find((n) => n.id === selectedGraphNodeId) || DEMO_GRAPH_NODES[0];
  const finance = DEMO_FINANCE_DATA[financePeriod];

  return (
    <div
      className={`relative rounded-2xl border border-[#27272A] bg-[#09090B] p-1.5 sm:p-2.5 shadow-2xl shadow-black/35 text-[#F4F4F5] transition-all ${className}`}
    >
      {/* 1. Window Titlebar Chrome */}
      <div className="flex h-11 w-full items-center justify-between border-b border-[#1E1E22] px-3.5 bg-[#0C0C0E] rounded-t-xl text-xs text-[#A1A1AA]">
        {/* Window controls & breadcrumb */}
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#27272A]" />
          <span className="h-3 w-3 rounded-full bg-[#27272A]" />
          <span className="h-3 w-3 rounded-full bg-[#27272A]" />
          <span className="ml-2 font-mono text-[11px] text-[#71717A] hidden sm:inline">
            Acme Systems Workspace • 3-Day Free Trial (Day 1)
          </span>
        </div>

        {/* Live In-Demo Search Input */}
        <div className="relative flex items-center max-w-xs w-full mx-2">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-[#71717A] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages, ADRs, or telemetry..."
            className="w-full rounded-md border border-[#1E1E22] bg-[#121215] pl-8 pr-7 py-1 text-[11px] text-[#F4F4F5] placeholder-[#71717A] focus:outline-none focus:border-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-[#71717A] hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-mono text-emerald-400 hidden sm:inline">
            Live Interactive Demo
          </span>
        </div>
      </div>

      {/* 2. Workstation Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[500px] bg-[#09090B] rounded-b-xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[#1E1E22]">
        {/* Left Column: Navigation Sidebar (Col 3 on desktop, horizontal bar on mobile) */}
        <div className="col-span-12 md:col-span-3 flex md:flex-col bg-[#0C0C0E] p-3 md:p-4 text-xs overflow-x-auto no-scrollbar md:overflow-visible">
          <div className="hidden md:flex items-center justify-between pb-3 border-b border-[#1E1E22]">
            <div>
              <span className="font-semibold text-white tracking-tight block">Acme Systems</span>
              <span className="text-[10px] font-mono text-[#71717A]">3-Day Free Trial</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              Active
            </span>
          </div>

          {/* Section Navigation Items */}
          <nav className="flex md:flex-col gap-1 w-full mt-0 md:mt-3 shrink-0">
            {[
              { id: "pages" as DemoSection, label: "Workspace Pages", icon: FileText, count: DEMO_PAGES.length },
              { id: "decisions" as DemoSection, label: "Decision Log (ADRs)", icon: Scale, count: DEMO_DECISIONS.length },
              { id: "graph" as DemoSection, label: "Company Graph", icon: Share2, count: DEMO_GRAPH_NODES.length },
              { id: "finance" as DemoSection, label: "Corporate Finance", icon: DollarSign, badge: "+14.2%" },
              { id: "integrations" as DemoSection, label: "Integrations", icon: GitBranch, count: 4 },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    if (item.id === "pages" && !selectedPageId) setSelectedPageId("page-strategy");
                    if (item.id === "decisions" && !selectedDecisionId) setSelectedDecisionId(null);
                  }}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-left font-medium transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isActive
                      ? "bg-[#1B1B20] text-white shadow-xs font-semibold"
                      : "text-[#A1A1AA] hover:bg-[#141418] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={`h-4 w-4 ${
                        isActive ? "text-blue-400" : "text-[#71717A]"
                      }`}
                    />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </div>

                  {item.badge ? (
                    <span className="hidden md:inline text-[10px] font-mono text-emerald-400">
                      {item.badge}
                    </span>
                  ) : item.count ? (
                    <span className="hidden md:inline text-[10px] font-mono text-[#71717A]">
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* Quick Context Peek at Bottom of Sidebar */}
          <div className="hidden md:block mt-auto pt-4 border-t border-[#1E1E22] text-[11px] text-[#71717A]">
            <div className="flex items-center justify-between">
              <span>Trial Expiration</span>
              <span className="font-mono text-amber-400">Day 1 of 3</span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span>Workspace Scope</span>
              <span className="font-mono text-emerald-400">Isolated Space</span>
            </div>
          </div>
        </div>

        {/* Right Area: Dynamic Interactive Workspace Views (Col 9 on desktop) */}
        <div className="col-span-12 md:col-span-9 p-4 sm:p-6 flex flex-col justify-between overflow-y-auto max-h-[620px]">
          {/* ================================================================= */}
          {/* VIEW 1: WORKSPACE PAGES */}
          {/* ================================================================= */}
          {activeSection === "pages" && (
            <div>
              {/* Document Reader Mode */}
              {activePage ? (
                <div>
                  {/* Top Bar with Back Navigation */}
                  <div className="flex items-center justify-between border-b border-[#1E1E22] pb-3 text-xs">
                    <button
                      onClick={() => setSelectedPageId(null)}
                      className="group flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded px-1"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                      <span>All Workspace Pages</span>
                    </button>

                    <span className="text-[11px] font-mono text-[#71717A]">
                      Revision OCC v{activePage.revision} • Synchronized
                    </span>
                  </div>

                  {/* Document Title & Meta */}
                  <div className="mt-4">
                    <div className="flex items-center gap-2 text-[11px] font-mono text-[#71717A]">
                      <span>Pages</span>
                      <span>/</span>
                      <span className="text-white">{activePage.category}</span>
                    </div>

                    <h3 className="mt-2 text-xl sm:text-2xl font-semibold text-white tracking-tight">
                      {activePage.title}
                    </h3>

                    <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-[#A1A1AA]">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-[#71717A]" />
                        <span>Edited {activePage.updatedAt}</span>
                      </span>
                      <span>•</span>
                      <span>By {activePage.author}</span>
                      <span>•</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Approved
                      </span>
                    </div>
                  </div>

                  {/* Render Document Blocks */}
                  <div className="mt-6 space-y-3.5 text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
                    {activePage.blocks.map((block, idx) => {
                      if (block.type === "callout") {
                        return (
                          <div
                            key={idx}
                            className={`rounded-xl border p-3.5 text-xs ${
                              block.meta?.calloutType === "warning"
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                                : block.meta?.calloutType === "success"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                : "border-blue-500/30 bg-blue-500/10 text-blue-200"
                            }`}
                          >
                            {block.content}
                          </div>
                        );
                      }
                      return <p key={idx}>{block.content}</p>;
                    })}
                  </div>

                  {/* Linked Architectural Decisions (Interactive Jump) */}
                  {activePage.linkedDecisionIds.length > 0 && (
                    <div className="mt-6 pt-5 border-t border-[#1E1E22]">
                      <span className="text-xs font-semibold text-white uppercase tracking-wider block mb-2.5">
                        Linked Architectural Decisions (ADRs)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {activePage.linkedDecisionIds.map((decId) => {
                          const dec = DEMO_DECISIONS.find((d) => d.id === decId);
                          if (!dec) return null;

                          return (
                            <button
                              key={dec.id}
                              onClick={() => {
                                setActiveSection("decisions");
                                setSelectedDecisionId(dec.id);
                              }}
                              className="group flex flex-col text-left rounded-lg border border-[#1E1E22] bg-[#121215] p-2.5 hover:border-blue-500 transition-colors"
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono">
                                <span className="text-amber-400 uppercase">{dec.code}</span>
                                <span className="text-emerald-400">{dec.status}</span>
                              </div>
                              <span className="mt-1 text-xs font-medium text-white group-hover:text-blue-400 transition-colors">
                                {dec.title}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Document List Mode */
                <div>
                  <div className="flex items-center justify-between border-b border-[#1E1E22] pb-3">
                    <span className="text-xs font-semibold uppercase text-white tracking-wider">
                      Workspace Pages ({filteredPages.length})
                    </span>
                    <span className="text-[11px] text-[#71717A]">
                      Select any document to inspect content
                    </span>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {filteredPages.map((page) => (
                      <button
                        key={page.id}
                        onClick={() => setSelectedPageId(page.id)}
                        className="group w-full flex flex-col text-left rounded-xl border border-[#1E1E22] bg-[#121215] p-4 hover:border-blue-500 hover:bg-[#16161A] transition-all"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-blue-400 font-mono text-[11px]">
                            {page.category}
                          </span>
                          <span className="text-[#71717A] text-[11px]">
                            Edited {page.updatedAt}
                          </span>
                        </div>

                        <h4 className="mt-1 text-sm sm:text-base font-semibold text-white group-hover:text-blue-400 transition-colors">
                          {page.title}
                        </h4>

                        <p className="mt-1 text-xs text-[#A1A1AA] line-clamp-2 leading-relaxed">
                          {page.snippet}
                        </p>

                        <div className="mt-3 flex items-center justify-between text-[11px] text-[#71717A] pt-2 border-t border-[#1E1E22]">
                          <span>{page.author}</span>
                          <span className="text-blue-400 group-hover:underline">Read page →</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW 2: DECISION LOG (ADRs) */}
          {/* ================================================================= */}
          {activeSection === "decisions" && (
            <div>
              {activeDecision ? (
                /* Decision Detail Reader */
                <div>
                  <div className="flex items-center justify-between border-b border-[#1E1E22] pb-3 text-xs">
                    <button
                      onClick={() => setSelectedDecisionId(null)}
                      className="group flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                      <span>All Decision Records</span>
                    </button>

                    <span className="text-[11px] font-mono text-emerald-400">
                      Status: {activeDecision.status}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center gap-2 text-[11px] font-mono text-amber-400">
                      <span>{activeDecision.code}</span>
                      <span>•</span>
                      <span>Ratified {activeDecision.date}</span>
                    </div>

                    <h3 className="mt-2 text-xl sm:text-2xl font-semibold text-white tracking-tight">
                      {activeDecision.title}
                    </h3>

                    <p className="mt-1 text-xs text-[#71717A]">
                      Key Drivers: {activeDecision.drivers.join(", ")}
                    </p>
                  </div>

                  <div className="mt-6 space-y-4 text-xs sm:text-sm text-[#A1A1AA]">
                    <div className="rounded-xl border border-[#1E1E22] bg-[#121215] p-4">
                      <span className="text-[10px] font-mono uppercase text-[#71717A] block font-semibold mb-1">
                        1. Context & Business Rationale
                      </span>
                      <p className="text-xs sm:text-sm leading-relaxed text-[#F4F4F5]">
                        {activeDecision.context}
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                      <span className="text-[10px] font-mono uppercase text-emerald-400 block font-semibold mb-1">
                        2. Accepted Decision
                      </span>
                      <p className="text-xs sm:text-sm leading-relaxed text-emerald-100">
                        {activeDecision.decision}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#1E1E22] bg-[#121215] p-4">
                      <span className="text-[10px] font-mono uppercase text-[#71717A] block font-semibold mb-1">
                        3. Consequences & Traceability
                      </span>
                      <p className="text-xs sm:text-sm leading-relaxed text-[#A1A1AA]">
                        {activeDecision.consequences}
                      </p>
                    </div>
                  </div>

                  {activeDecision.linkedPageId && (
                    <div className="mt-6 pt-4 border-t border-[#1E1E22] flex items-center justify-between text-xs">
                      <span className="text-[#71717A]">Referenced Document:</span>
                      <button
                        onClick={() => {
                          setActiveSection("pages");
                          setSelectedPageId(activeDecision.linkedPageId!);
                        }}
                        className="text-blue-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        <span>Open Strategy Document</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Decision List */
                <div>
                  <div className="flex items-center justify-between border-b border-[#1E1E22] pb-3">
                    <span className="text-xs font-semibold uppercase text-white tracking-wider">
                      Architectural Decision Log ({filteredDecisions.length})
                    </span>
                    <span className="text-[11px] text-[#71717A]">
                      Select an ADR to inspect decision context
                    </span>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {filteredDecisions.map((dec) => (
                      <button
                        key={dec.id}
                        onClick={() => setSelectedDecisionId(dec.id)}
                        className="group w-full flex flex-col text-left rounded-xl border border-[#1E1E22] bg-[#121215] p-4 hover:border-amber-500 hover:bg-[#16161A] transition-all"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-amber-400 font-mono text-[11px] font-semibold">
                            {dec.code}
                          </span>
                          <span className="text-emerald-400 text-[11px] font-medium bg-emerald-950/60 border border-emerald-500/20 px-2 py-0.5 rounded">
                            {dec.status}
                          </span>
                        </div>

                        <h4 className="mt-1 text-sm sm:text-base font-semibold text-white group-hover:text-amber-400 transition-colors">
                          {dec.title}
                        </h4>

                        <p className="mt-1 text-xs text-[#A1A1AA] line-clamp-2 leading-relaxed">
                          {dec.context}
                        </p>

                        <div className="mt-3 flex items-center justify-between text-[11px] text-[#71717A] pt-2 border-t border-[#1E1E22]">
                          <span>Ratified: {dec.date}</span>
                          <span className="text-amber-400 group-hover:underline">
                            Inspect rationale →
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW 3: COMPANY GRAPH */}
          {/* ================================================================= */}
          {activeSection === "graph" && (
            <div className="flex flex-col justify-between h-full space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E1E22] pb-3 text-xs">
                <span className="font-semibold text-white">Topological Company Graph</span>
                <span className="text-[11px] font-mono text-emerald-400">
                  BFS O(V + E) Traversal Active
                </span>
              </div>

              {/* Interactive SVG Canvas */}
              <div className="relative h-64 sm:h-72 w-full rounded-xl border border-[#1E1E22] bg-[#0C0C0E] flex items-center justify-center overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Edges */}
                  {DEMO_GRAPH_NODES.map((node) =>
                    node.connections.map((targetId) => {
                      const target = DEMO_GRAPH_NODES.find((n) => n.id === targetId);
                      if (!target) return null;
                      const isHighlighted =
                        node.id === selectedGraphNodeId || target.id === selectedGraphNodeId;

                      return (
                        <line
                          key={`${node.id}-${target.id}`}
                          x1={`${node.x}%`}
                          y1={`${node.y}%`}
                          x2={`${target.x}%`}
                          y2={`${target.y}%`}
                          stroke={isHighlighted ? "#6366F1" : "#1E1E22"}
                          strokeWidth={isHighlighted ? "2" : "0.75"}
                          strokeDasharray={isHighlighted ? undefined : "2 2"}
                        />
                      );
                    })
                  )}
                </svg>

                {/* Nodes */}
                {DEMO_GRAPH_NODES.map((node) => {
                  const isSelected = node.id === selectedGraphNodeId;

                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedGraphNodeId(node.id)}
                      style={{ left: `${node.x}%`, top: `${node.y}%` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                        isSelected
                          ? "border-indigo-400 bg-[#18181B] text-white shadow-lg shadow-indigo-500/20 scale-105 z-10"
                          : "border-[#1E1E22] bg-[#121215] text-[#A1A1AA] hover:border-[#3F3F46] hover:text-white"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          node.type === "decision"
                            ? "bg-amber-400"
                            : node.type === "project"
                            ? "bg-blue-400"
                            : node.type === "repo"
                            ? "bg-purple-400"
                            : node.type === "meeting"
                            ? "bg-emerald-400"
                            : "bg-indigo-400"
                        }`}
                      />
                      <span className="whitespace-nowrap">{node.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* Node Details Peek Drawer */}
              <div className="rounded-xl border border-[#1E1E22] bg-[#121215] p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[#71717A] uppercase">
                    <span>{activeGraphNode.typeLabel}</span>
                    <span>•</span>
                    <span>{activeGraphNode.connections.length} Connections</span>
                  </div>
                  <h4 className="mt-0.5 text-sm font-semibold text-white">
                    {activeGraphNode.title}
                  </h4>
                  <p className="mt-0.5 text-xs text-[#A1A1AA]">
                    {activeGraphNode.summary}
                  </p>
                </div>

                {activeGraphNode.referenceId && (
                  <button
                    onClick={() => {
                      if (activeGraphNode.type === "decision") {
                        setActiveSection("decisions");
                        setSelectedDecisionId(activeGraphNode.referenceId!);
                      } else {
                        setActiveSection("pages");
                        setSelectedPageId(activeGraphNode.referenceId!);
                      }
                    }}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
                  >
                    <span>View Record</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW 4: CORPORATE FINANCE */}
          {/* ================================================================= */}
          {activeSection === "finance" && (
            <div className="flex flex-col justify-between h-full space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E1E22] pb-3 text-xs">
                <div>
                  <span className="font-semibold text-white">Executive Corporate Finance</span>
                  <span className="text-[11px] text-[#71717A] block">
                    Stripe Connect telemetry & cohort retention
                  </span>
                </div>

                {/* Period Filter Buttons */}
                <div className="flex items-center gap-1 bg-[#121215] p-1 rounded-lg border border-[#1E1E22]">
                  {(["30d", "q3", "ytd"] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setFinancePeriod(period)}
                      className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                        financePeriod === period
                          ? "bg-[#1E1E22] text-white font-semibold"
                          : "text-[#71717A] hover:text-white"
                      }`}
                    >
                      {period.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-[#1E1E22] bg-[#121215] p-3">
                  <span className="text-[11px] text-[#71717A] block">MRR</span>
                  <span className="text-lg font-semibold text-white font-mono block mt-1">
                    {finance.mrr}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5 mt-0.5">
                    <TrendingUp className="h-3 w-3" /> {finance.mrrGrowth}
                  </span>
                </div>

                <div className="rounded-xl border border-[#1E1E22] bg-[#121215] p-3">
                  <span className="text-[11px] text-[#71717A] block">ARR Run-Rate</span>
                  <span className="text-lg font-semibold text-white font-mono block mt-1">
                    {finance.arr}
                  </span>
                  <span className="text-[10px] font-mono text-[#71717A] block mt-0.5">
                    Normalized
                  </span>
                </div>

                <div className="rounded-xl border border-[#1E1E22] bg-[#121215] p-3">
                  <span className="text-[11px] text-[#71717A] block">Net Revenue</span>
                  <span className="text-lg font-semibold text-white font-mono block mt-1">
                    {finance.netRevenue}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 block mt-0.5">
                    Settled
                  </span>
                </div>

                <div className="rounded-xl border border-[#1E1E22] bg-[#121215] p-3">
                  <span className="text-[11px] text-[#71717A] block">Churn Rate</span>
                  <span className="text-lg font-semibold text-white font-mono block mt-1">
                    {finance.churnRate}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5 mt-0.5">
                    <TrendingDown className="h-3 w-3" /> Low Risk
                  </span>
                </div>
              </div>

              {/* History Bar Visualization */}
              <div className="rounded-xl border border-[#1E1E22] bg-[#121215] p-4">
                <div className="flex items-center justify-between text-xs text-[#71717A] mb-3">
                  <span>Growth Velocity ({financePeriod.toUpperCase()})</span>
                  <span className="font-mono text-white">{finance.activeSubscriptions} Active Workspaces</span>
                </div>

                <div className="flex items-end gap-3 h-28 pt-2">
                  {finance.history.map((h, i) => {
                    const maxVal = Math.max(...finance.history.map((x) => x.value));
                    const heightPercent = Math.round((h.value / maxVal) * 100);

                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full rounded-t bg-gradient-to-t from-blue-600 to-indigo-500 opacity-90 hover:opacity-100 transition-opacity"
                        />
                        <span className="text-[10px] font-mono text-[#71717A]">{h.month}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Plan Distribution */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                {finance.tierBreakdown.map((t, idx) => (
                  <div key={idx} className="rounded-lg border border-[#1E1E22] bg-[#0C0C0E] p-2 text-center">
                    <span className="text-[10px] text-[#71717A] block">{t.tier}</span>
                    <span className="font-mono font-semibold text-white mt-0.5 block">{t.count} teams</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW 5: INTEGRATIONS TELEMETRY */}
          {/* ================================================================= */}
          {activeSection === "integrations" && (
            <div className="flex flex-col justify-between h-full space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E1E22] pb-3 text-xs">
                <div>
                  <span className="font-semibold text-white">Ecosystem Data Streams</span>
                  <span className="text-[11px] text-[#71717A] block">
                    Real-time webhooks & synchronized events
                  </span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> 4 Operational
                </span>
              </div>

              {/* Telemetry Stream */}
              <div className="space-y-2.5">
                {DEMO_TELEMETRY.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-[#1E1E22] bg-[#121215] p-3 text-xs flex items-start gap-3"
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#1B1B20] text-blue-400">
                      <GitBranch className="h-3.5 w-3.5" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-white">{event.sourceName}</span>
                        <span className="text-[#71717A] font-mono">{event.time}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#A1A1AA] leading-relaxed">
                        {event.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-200">
                <span className="font-semibold block mb-0.5">Bi-Directional Context Engine</span>
                Telemetry events link automatically to open pages and accepted decision records without manual tagging.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
