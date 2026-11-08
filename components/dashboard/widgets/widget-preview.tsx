"use client";

import * as React from "react";
import {
  TrendingUp,
  FileText,
  Clock,
} from "lucide-react";
import {
  PhosphorFolder,
  PhosphorGitBranch,
  PhosphorBookOpen,
  PhosphorNetwork,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  VisualizationType,
  WidgetSize,
  TimeRange,
  ChartGranularity,
} from "@/lib/widgets/types";
import { getMetricCapability } from "@/lib/widgets/registry";
import { useLanguage } from "@/lib/i18n";

export interface WidgetPreviewProps {
  metricId: string;
  visualization: VisualizationType;
  size: WidgetSize;
  title?: string;
  timeRange?: TimeRange;
  granularity?: ChartGranularity;
  className?: string;
}

export function WidgetPreview({
  metricId,
  visualization,
  timeRange = "current",
  className,
}: WidgetPreviewProps) {
  const { locale } = useLanguage();
  const capability = getMetricCapability(metricId);

  const sampleAmount = (18450).toLocaleString(locale === "pt" ? "pt-PT" : "en-US", {
    style: "currency",
    currency: "EUR",
  });

  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200 dark:border-border bg-white dark:bg-[#121316] p-4 shadow-xs flex flex-col justify-center transition-all select-none overflow-hidden min-h-[160px]",
        className
      )}
    >
      {/* 1. KPI / NUMBERS */}
      {visualization === "kpi" && (
        <div className="space-y-1.5 py-1">
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-zinc-900 dark:text-white">
            {capability?.unit === "cents" ? sampleAmount : "28"}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-semibold font-mono">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>+18.4%</span>
          </div>
        </div>
      )}

      {/* 2. TREND CHART (chart): Trajectory & Momentum, Sparkline, No Area Fill */}
      {visualization === "chart" && (
        <div className="space-y-2 py-1">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
              {sampleAmount}
            </span>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold font-mono border border-emerald-500/20">
              <TrendingUp className="h-3 w-3" />
              <span>+18.4%</span>
            </div>
          </div>
          <div className="h-20 w-full rounded-xl bg-zinc-50 dark:bg-[#0A0B0D] p-2 flex items-center relative overflow-hidden border border-zinc-200/50 dark:border-white/[0.04]">
            <svg className="w-full h-full" viewBox="0 0 240 60" preserveAspectRatio="none">
              <line x1="0" y1="50" x2="240" y2="50" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
              <line x1="0" y1="15" x2="240" y2="15" stroke="currentColor" strokeOpacity="0.05" strokeWidth="1" strokeDasharray="3 3" />
              <path
                d="M 5 45 Q 60 40 100 32 T 180 18 T 235 12"
                fill="none"
                stroke="#10B981"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Start anchor */}
              <circle cx="5" cy="45" r="3" fill="#3B82F6" />
              {/* End anchor with pulse ring */}
              <circle cx="235" cy="12" r="6" fill="rgba(16, 185, 129, 0.25)" />
              <circle cx="235" cy="12" r="3.5" fill="#10B981" />
            </svg>
          </div>
        </div>
      )}

      {/* 3. LINE CHART (line): Data Precision, Visible Nodes on Every Point, Average Benchmark Line */}
      {visualization === "line" && (
        <div className="space-y-2 py-1">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
              {sampleAmount}
            </span>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
              <span className="text-zinc-400">Média:</span>
              <span>14.200 €</span>
            </div>
          </div>
          <div className="h-20 w-full rounded-xl bg-zinc-50 dark:bg-[#0A0B0D] p-2 flex items-center relative overflow-hidden border border-zinc-200/50 dark:border-white/[0.04]">
            <svg className="w-full h-full" viewBox="0 0 240 60" preserveAspectRatio="none">
              {/* Average guideline */}
              <line x1="0" y1="30" x2="240" y2="30" stroke="#3B82F6" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="4 4" />
              {/* Baseline */}
              <line x1="0" y1="52" x2="240" y2="52" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
              {/* Line path */}
              <path
                d="M 15 46 L 60 38 L 105 32 L 150 22 L 195 28 L 230 14"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Visible nodes on each data point */}
              <circle cx="15" cy="46" r="3.5" className="fill-white dark:fill-zinc-900 stroke-blue-600 stroke-2" />
              <circle cx="60" cy="38" r="3.5" className="fill-white dark:fill-zinc-900 stroke-blue-600 stroke-2" />
              <circle cx="105" cy="32" r="3.5" className="fill-white dark:fill-zinc-900 stroke-blue-600 stroke-2" />
              <circle cx="150" cy="22" r="3.5" className="fill-white dark:fill-zinc-900 stroke-blue-600 stroke-2" />
              <circle cx="195" cy="28" r="3.5" className="fill-white dark:fill-zinc-900 stroke-blue-600 stroke-2" />
              <circle cx="230" cy="14" r="4.5" className="fill-blue-500 stroke-white stroke-2" />
            </svg>
          </div>
        </div>
      )}

      {/* 4. AREA CHART (area): Rich Volume Gradient Fill Under Curve */}
      {visualization === "area" && (
        <div className="space-y-2 py-1">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
              {sampleAmount}
            </span>
            <span className="text-[11px] font-mono text-blue-500 font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">
              Volume
            </span>
          </div>
          <div className="h-20 w-full rounded-xl bg-zinc-50 dark:bg-[#0A0B0D] p-1 flex items-end relative overflow-hidden border border-zinc-200/50 dark:border-white/[0.04]">
            <svg className="w-full h-full" viewBox="0 0 240 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaPrevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.45" />
                  <stop offset="70%" stopColor="#3B82F6" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 48 Q 50 40 90 28 T 170 20 T 240 8 L 240 60 L 0 60 Z"
                fill="url(#areaPrevGrad)"
              />
              <path
                d="M 0 48 Q 50 40 90 28 T 170 20 T 240 8"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      )}

      {/* 5. DONUT / CIRCULAR CHART */}
      {visualization === "donut" && (
        <div className="flex items-center justify-center gap-6 py-2">
          <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              {/* Background circle */}
              <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="4.5" />
              {/* Blue Segment: 55% */}
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="4.5"
                strokeDasharray="48.38 87.96"
                strokeDashoffset="0"
              />
              {/* Emerald Segment: 30% */}
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="#10B981"
                strokeWidth="4.5"
                strokeDasharray="26.39 87.96"
                strokeDashoffset="-48.38"
              />
              {/* Amber Segment: 15% */}
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="4.5"
                strokeDasharray="13.19 87.96"
                strokeDashoffset="-74.77"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] font-bold font-mono text-zinc-900 dark:text-white">100%</span>
            </div>
          </div>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Pro: 55%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Starter: 30%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Enterprise: 15%</span>
            </div>
          </div>
        </div>
      )}

      {/* 6. RADIAL GAUGE */}
      {(visualization === "radial_gauge" || visualization === "gauge") && (
        <div className="flex flex-col items-center justify-center py-2">
          <div className="relative flex items-center justify-center">
            <svg className="w-28 h-16" viewBox="0 0 100 55">
              <path
                d="M 12 50 A 38 38 0 0 1 88 50"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <path
                d="M 12 50 A 38 38 0 0 1 76 22"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="7"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute bottom-0 text-center">
              <span className="text-xl font-bold font-mono text-zinc-900 dark:text-white">82%</span>
            </div>
          </div>
        </div>
      )}

      {/* 7. DISTRIBUTION BARS */}
      {visualization === "bar" && (
        <div className="space-y-2 py-1">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-700 dark:text-zinc-300">
            <span>Pro 58%</span>
            <span>Starter 28%</span>
            <span>Enterprise 14%</span>
          </div>
          <div className="h-3.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 flex overflow-hidden p-0.5">
            <div className="h-full bg-blue-500 rounded-l-full w-[58%]" />
            <div className="h-full bg-emerald-500 w-[28%]" />
            <div className="h-full bg-purple-500 rounded-r-full w-[14%]" />
          </div>
        </div>
      )}

      {/* 8. DATA TABLE */}
      {visualization === "table" && (
        <div className="space-y-1.5 text-xs py-1">
          <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-zinc-100 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                Customizable Dashboard
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">Ativo</span>
          </div>
          <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-zinc-100 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                Audit Streaming Engine
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">Concluído</span>
          </div>
        </div>
      )}

      {/* 9. PRIORITIES */}
      {visualization === "priorities" && (
        <div className="space-y-1.5 text-xs py-1">
          <div className="flex items-center justify-between py-2 px-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center gap-2">
              <PhosphorGitBranch className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                ADR-004: Persistência CAS
              </span>
            </div>
            <span className="text-[10px] font-semibold text-amber-500">Urgente</span>
          </div>
        </div>
      )}

      {/* 10. PULSE KPIS */}
      {visualization === "pulse_kpis" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs py-1">
          <div className="p-2 rounded-xl bg-zinc-100 dark:bg-[#0E1013] border border-zinc-200/70 dark:border-white/[0.04]">
            <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-medium">
              <PhosphorFolder className="h-3 w-3 text-emerald-400" />
              Projetos
            </span>
            <div className="text-base font-bold text-zinc-900 dark:text-white mt-1 font-mono">4</div>
          </div>
          <div className="p-2 rounded-xl bg-zinc-100 dark:bg-[#0E1013] border border-zinc-200/70 dark:border-white/[0.04]">
            <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-medium">
              <PhosphorGitBranch className="h-3 w-3 text-amber-400" />
              ADRs
            </span>
            <div className="text-base font-bold text-zinc-900 dark:text-white mt-1 font-mono">7</div>
          </div>
          <div className="p-2 rounded-xl bg-zinc-100 dark:bg-[#0E1013] border border-zinc-200/70 dark:border-white/[0.04]">
            <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-medium">
              <PhosphorBookOpen className="h-3 w-3 text-purple-400" />
              Páginas
            </span>
            <div className="text-base font-bold text-zinc-900 dark:text-white mt-1 font-mono">12</div>
          </div>
          <div className="p-2 rounded-xl bg-zinc-100 dark:bg-[#0E1013] border border-zinc-200/70 dark:border-white/[0.04]">
            <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-medium">
              <PhosphorNetwork className="h-3 w-3 text-indigo-400" />
              Conexões
            </span>
            <div className="text-base font-bold text-zinc-900 dark:text-white mt-1 font-mono">38</div>
          </div>
        </div>
      )}

      {/* 11. STRIP */}
      {visualization === "strip" && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-100 dark:bg-[#0E1013] border border-zinc-200/70 dark:border-white/[0.04]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 font-medium">Receita</span>
              <div className="text-sm font-bold text-zinc-900 dark:text-white font-mono">
                18.420 €
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-zinc-400 font-medium">MRR</span>
            <div className="text-sm font-bold text-indigo-400 font-mono">1.940 €</div>
          </div>
        </div>
      )}

      {/* 12. TOPOLOGY */}
      {visualization === "topology" && (
        <div className="h-16 w-full rounded-xl bg-zinc-100 dark:bg-[#0A0B0D] border border-zinc-200/70 dark:border-white/[0.04] p-2 flex items-center justify-center">
          <svg className="w-full h-full" viewBox="0 0 160 50">
            <line x1="30" y1="25" x2="80" y2="15" stroke="rgba(129,140,248,0.5)" strokeWidth="1" strokeDasharray="2 2" />
            <line x1="80" y1="15" x2="130" y2="25" stroke="rgba(129,140,248,0.5)" strokeWidth="1" strokeDasharray="2 2" />
            <line x1="80" y1="15" x2="80" y2="40" stroke="rgba(16,185,129,0.5)" strokeWidth="1" />
            <circle cx="80" cy="15" r="4" fill="#818CF8" />
            <circle cx="30" cy="25" r="3.5" fill="#F59E0B" />
            <circle cx="130" cy="25" r="3.5" fill="#10B981" />
            <circle cx="80" cy="40" r="3" fill="#A855F7" />
          </svg>
        </div>
      )}

      {/* 13. PAGES */}
      {visualization === "pages" && (
        <div className="space-y-1.5 text-xs py-1">
          <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-zinc-100 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-zinc-800 dark:text-zinc-200 font-semibold truncate">
                Product Blueprint
              </span>
            </div>
            <span className="text-[10px] text-zinc-400">Hoje</span>
          </div>
        </div>
      )}

      {/* 14. TIMELINE */}
      {visualization === "timeline" && (
        <div className="space-y-1.5 text-xs py-1">
          <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-zinc-100 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate">
                Deploy efetuado
              </span>
            </div>
            <span className="text-[10px] text-zinc-400">10m</span>
          </div>
        </div>
      )}

      {/* 15. PROGRESS */}
      {visualization === "progress" && (
        <div className="space-y-2 text-xs py-1">
          <div className="flex items-center justify-between font-semibold">
            <span className="text-zinc-700 dark:text-zinc-300">Meta</span>
            <span className="font-mono text-blue-500">78%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full w-[78%]" />
          </div>
        </div>
      )}

      {/* 16. AGENDA */}
      {visualization === "agenda" && (
        <div className="space-y-1.5 text-xs py-1">
          <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-zinc-100 dark:bg-white/[0.03]">
            <div className="flex flex-col items-center justify-center px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-mono text-[9px] font-bold shrink-0">
              <span>QUI</span>
              <span>29</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">Sprint Sync</p>
              <p className="text-[10px] text-zinc-400">14:30 — 15:30</p>
            </div>
          </div>
        </div>
      )}

      {/* 17. CARDS */}
      {visualization === "cards" && (
        <div className="grid grid-cols-2 gap-2 text-xs py-1">
          <div className="p-2.5 rounded-xl border border-zinc-200 dark:border-border bg-zinc-50 dark:bg-surface-secondary/50">
            <span className="text-[10px] font-mono text-amber-400 uppercase font-semibold">Decisão</span>
            <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">PostgreSQL 16</p>
          </div>
          <div className="p-2.5 rounded-xl border border-zinc-200 dark:border-border bg-zinc-50 dark:bg-surface-secondary/50">
            <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">Projeto</span>
            <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">Customizer V2</p>
          </div>
        </div>
      )}
    </div>
  );
}
