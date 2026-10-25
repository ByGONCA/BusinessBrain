"use client";

import * as React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";
import { DEMO_GRAPH_NODES, GraphNodeDemo } from "@/lib/marketing/config";
import {
  Share2,
  FileText,
  Scale,
  FolderGit2,
  Calendar,
  GitBranch,
  ArrowRight,
  Info,
} from "lucide-react";

export function LandingGraphSection() {
  const { t } = useLanguage();
  const [selectedNodeId, setSelectedNodeId] = React.useState<string>("node-1");
  const { ref: sectionRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.15 });

  const selectedNode =
    DEMO_GRAPH_NODES.find((n) => n.id === selectedNodeId) || DEMO_GRAPH_NODES[0];

  const connectedNodes = DEMO_GRAPH_NODES.filter((n) =>
    selectedNode.connections.includes(n.id)
  );

  return (
    <section
      id="graph"
      ref={sectionRef}
      className="py-20 md:py-28 bg-[#FAF9F5] dark:bg-[#09090B] border-t border-[#E5E5E0] dark:border-[#1E1E22] transition-colors"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section Header */}
        <div
          className={`mx-auto max-w-3xl text-center transition-all duration-550 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="text-xs font-mono font-medium tracking-widest uppercase text-[#71717A] dark:text-[#A1A1AA]">
            {t.landing.graph.eyebrow}
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#18181B] dark:text-[#F4F4F5] sm:text-5xl">
            {t.landing.graph.title}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
            {t.landing.graph.subtitle}
          </p>
        </div>

        {/* Interactive Graph Canvas + Inspector Drawer */}
        <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Interactive SVG Graph Area (Col 8) */}
          <div
            className={`lg:col-span-8 rounded-2xl border border-[#27272A] bg-[#09090B] p-4 sm:p-6 shadow-xl relative min-h-[460px] flex flex-col justify-between overflow-hidden transition-all duration-600 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {/* Top Toolbar */}
            <div className="flex items-center justify-between border-b border-[#1E1E22] pb-3 text-xs text-[#A1A1AA]">
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-indigo-400" />
                <span className="font-mono font-medium text-white">Company Graph Engine</span>
                <span className="text-[10px] font-mono text-[#71717A]">• BFS O(V + E)</span>
              </div>
              <span className="text-[11px] text-[#71717A] hidden sm:inline">
                Click any node to inspect relationships
              </span>
            </div>

            {/* SVG Interactive Canvas */}
            <div className="relative flex-1 w-full h-[360px] my-4">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Connecting Edges */}
                {DEMO_GRAPH_NODES.map((node) =>
                  node.connections.map((targetId) => {
                    const target = DEMO_GRAPH_NODES.find((n) => n.id === targetId);
                    if (!target) return null;

                    const isHighlighted =
                      node.id === selectedNodeId || target.id === selectedNodeId;

                    return (
                      <line
                        key={`${node.id}-${target.id}`}
                        x1={`${node.x}%`}
                        y1={`${node.y}%`}
                        x2={`${target.x}%`}
                        y2={`${target.y}%`}
                        stroke={isHighlighted ? "#6366F1" : "#27272A"}
                        strokeWidth={isHighlighted ? "1.4" : "0.6"}
                        strokeDasharray={isHighlighted ? "none" : "2,2"}
                        className={`transition-all duration-500 ${
                          isVisible ? "opacity-100" : "opacity-0"
                        }`}
                      />
                    );
                  })
                )}
              </svg>

              {/* Node Overlay Points */}
              {DEMO_GRAPH_NODES.map((node, idx) => {
                const isSelected = node.id === selectedNodeId;
                const isConnected = selectedNode.connections.includes(node.id);

                return (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    style={{
                      left: `${node.x}%`,
                      top: `${node.y}%`,
                      transitionDelay: `${idx * 40}ms`,
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 hover:scale-105 active:scale-95 ${
                      isVisible ? "opacity-100 scale-100" : "opacity-0 scale-90"
                    } ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 scale-105 z-20 border border-indigo-400"
                        : isConnected
                        ? "bg-[#1B1B20] text-indigo-300 border border-indigo-500/40 z-10"
                        : "bg-[#121215] text-[#A1A1AA] border border-[#27272A] hover:border-[#3F3F46] hover:text-white"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full transition-colors duration-200 ${
                        isSelected
                          ? "bg-white"
                          : isConnected
                          ? "bg-indigo-400"
                          : "bg-[#52525B]"
                      }`}
                    />
                    <span className="whitespace-nowrap font-medium text-[11px]">
                      {node.title}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Status Bar */}
            <div className="border-t border-[#1E1E22] pt-3 flex items-center justify-between text-xs text-[#71717A]">
              <span>Active Graph Nodes: {DEMO_GRAPH_NODES.length}</span>
              <span className="font-mono text-[11px] text-emerald-400">Deterministic Traversal</span>
            </div>
          </div>

          {/* Side Entity Inspector Drawer (Col 4) */}
          <div
            className={`lg:col-span-4 rounded-2xl border border-[#E5E5E0] dark:border-[#1E1E22] bg-white dark:bg-[#121215] p-6 shadow-xs flex flex-col justify-between transition-all duration-600 delay-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div key={selectedNode.id} className="animate-in fade-in-50 duration-300">
              <div className="flex items-center justify-between border-b border-[#E5E5E0] dark:border-[#1E1E22] pb-3 text-xs text-[#71717A] dark:text-[#A1A1AA]">
                <span className="font-mono uppercase font-semibold text-[10px]">
                  {t.landing.graph.selectedNode}
                </span>
                <span className="capitalize text-indigo-600 dark:text-indigo-400 font-medium">
                  {selectedNode.typeLabel}
                </span>
              </div>

              <h3 className="mt-4 text-lg font-semibold text-[#18181B] dark:text-[#F4F4F5]">
                {selectedNode.title}
              </h3>

              <p className="mt-2 text-xs leading-relaxed text-[#52525B] dark:text-[#A1A1AA]">
                {selectedNode.summary}
              </p>

              <div className="mt-6 pt-5 border-t border-[#E5E5E0] dark:border-[#1E1E22]">
                <div className="flex items-center justify-between text-xs font-medium text-[#18181B] dark:text-[#F4F4F5]">
                  <span>{t.landing.graph.connectedEntities}</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                    {connectedNodes.length} active
                  </span>
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  {connectedNodes.map((conn) => (
                    <button
                      key={conn.id}
                      onClick={() => setSelectedNodeId(conn.id)}
                      className="flex items-center justify-between rounded-lg border border-[#E5E5E0] dark:border-[#1E1E22] bg-[#FAF9F5] dark:bg-[#1B1B20] p-2.5 text-xs text-left hover:border-indigo-400 hover:bg-white dark:hover:bg-[#202028] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                        <span className="font-medium text-[#18181B] dark:text-[#F4F4F5] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {conn.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#71717A] dark:text-[#A1A1AA] uppercase">
                        {conn.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#E5E5E0] dark:border-[#1E1E22] text-[11px] text-[#71717A] dark:text-[#A1A1AA] leading-relaxed">
              Every document, pull request, or meeting created in BusinessBrain automatically updates this relationship graph.
            </div>
          </div>
        </div>

        {/* Dedicated Company Graph Page Jump Button */}
        <div className="mt-12 text-center">
          <Link
            href="/company-graph"
            className="group inline-flex items-center gap-2 rounded-xl border border-[#D4D4D8] dark:border-[#27272A] bg-white dark:bg-[#121215] px-5 py-2.5 text-xs font-semibold text-[#18181B] dark:text-[#F4F4F5] hover:bg-[#F4F4F5] dark:hover:bg-[#1B1B20] active:scale-[0.98] transition-all duration-200 shadow-xs"
          >
            <span>Explore Dedicated Company Graph & Traversal Engine</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
