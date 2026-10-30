"use client";

import * as React from "react";
import {
  TrendingUp,
  FileText,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  PhosphorFolder,
  PhosphorGitBranch,
  PhosphorBookOpen,
  PhosphorNetwork,
  PhosphorCheckSquare,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  VisualizationType,
  WidgetSize,
  TimeRange,
  ChartGranularity,
} from "@/lib/widgets/types";
import { getMetricCapability } from "@/lib/widgets/registry";
import { useLanguage, resolveTranslationKey } from "@/lib/i18n";

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
  size,
  title,
  timeRange = "current",
  granularity = "monthly",
  className,
}: WidgetPreviewProps) {
  const { t, locale } = useLanguage();
  const capability = getMetricCapability(metricId);

  const displayTitle =
    title?.trim() ||
    (capability?.labelKey ? resolveTranslationKey(t, capability.labelKey) : undefined) ||
    capability?.id ||
    "Bloco";

  const sizeLabel =
    size === "sm"
      ? "1 Coluna (Compacto)"
      : size === "md"
      ? "2 Colunas (Padrão)"
      : size === "lg"
      ? "3 Colunas (Largo)"
      : "4 Colunas (Total)";

  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-[#121316] p-4 shadow-sm flex flex-col justify-between transition-all select-none overflow-hidden",
        className
      )}
    >
      {/* Top Header of Preview Card */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-white/[0.04]">
        <div className="min-w-0 pr-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-blue-500 font-semibold flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5" />
            <span>{sizeLabel}</span>
          </span>
          <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white tracking-tight truncate mt-0.5">
            {displayTitle}
          </h4>
        </div>

        <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-200/70 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 font-mono shrink-0">
          {timeRange}
        </span>
      </div>

      {/* Body Visualization Preview */}
      <div className="py-4 flex-1 flex flex-col justify-center">
        {/* 1. KPI / NUMBERS */}
        {visualization === "kpi" && (
          <div className="space-y-2">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-zinc-900 dark:text-white">
              {capability?.unit === "cents"
                ? (15420).toLocaleString(locale === "pt" ? "pt-PT" : "en-US", {
                    style: "currency",
                    currency: "EUR",
                  })
                : "28"}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>+18.4%</span>
              <span className="text-zinc-500 dark:text-zinc-400 text-[11px] font-normal">
                vs. período anterior
              </span>
            </div>
          </div>
        )}

        {/* 2. TREND LINE CHART */}
        {visualization === "chart" && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
                48.250,00 €
              </span>
              <span className="text-[11px] text-zinc-400">
                {granularity === "daily" ? "Ritmo Diário" : "Curva Mensal"}
              </span>
            </div>
            <div className="h-20 w-full rounded-lg bg-zinc-100 dark:bg-zinc-900/60 p-1 flex items-end relative overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="prevChartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,50 Q40,40 70,30 T140,20 T200,8 L200,60 L0,60 Z"
                  fill="url(#prevChartGrad)"
                />
                <path
                  d="M0,50 Q40,40 70,30 T140,20 T200,8"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        )}

        {/* 3. DISTRIBUTION BARS */}
        {visualization === "bar" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Pro (58%)</span>
              <span>Starter (28%)</span>
              <span>Enterprise (14%)</span>
            </div>
            <div className="h-3 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 flex overflow-hidden">
              <div className="h-full bg-blue-500 w-[58%]" />
              <div className="h-full bg-emerald-500 w-[28%]" />
              <div className="h-full bg-purple-500 w-[14%]" />
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              Distribuição proporcional por plano de subscrição ativo
            </p>
          </div>
        )}

        {/* 4. DATA TABLE */}
        {visualization === "table" && (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between py-1 px-2 rounded-md bg-zinc-200/50 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Customizable Dashboard
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">Ativo</span>
            </div>
            <div className="flex items-center justify-between py-1 px-2 rounded-md bg-zinc-200/50 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Audit Streaming Engine
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">Concluído</span>
            </div>
          </div>
        )}

        {/* 5. PRIORITIES */}
        {visualization === "priorities" && (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center gap-2">
                <PhosphorGitBranch className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  ADR-004: Persistência CAS
                </span>
              </div>
              <span className="text-[10px] font-semibold text-amber-500">Urgente</span>
            </div>
          </div>
        )}

        {/* 6. PULSE KPIS */}
        {visualization === "pulse_kpis" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-[#0E1013] border border-zinc-200/70 dark:border-white/[0.04]">
              <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                <PhosphorFolder className="h-3 w-3 text-emerald-400" />
                Projetos
              </span>
              <div className="text-base font-bold text-zinc-900 dark:text-white mt-1">4</div>
            </div>
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-[#0E1013] border border-zinc-200/70 dark:border-white/[0.04]">
              <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                <PhosphorGitBranch className="h-3 w-3 text-amber-400" />
                ADRs
              </span>
              <div className="text-base font-bold text-zinc-900 dark:text-white mt-1">7</div>
            </div>
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-[#0E1013] border border-zinc-200/70 dark:border-white/[0.04]">
              <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                <PhosphorBookOpen className="h-3 w-3 text-purple-400" />
                Páginas
              </span>
              <div className="text-base font-bold text-zinc-900 dark:text-white mt-1">12</div>
            </div>
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-[#0E1013] border border-zinc-200/70 dark:border-white/[0.04]">
              <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                <PhosphorNetwork className="h-3 w-3 text-indigo-400" />
                Conexões
              </span>
              <div className="text-base font-bold text-zinc-900 dark:text-white mt-1">38</div>
            </div>
          </div>
        )}

        {/* 7. STRIP */}
        {visualization === "strip" && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-100 dark:bg-[#0E1013] border border-zinc-200/70 dark:border-white/[0.04]">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] text-zinc-400">Receita Líquida</span>
                <div className="text-sm font-bold text-zinc-900 dark:text-white font-mono">
                  18.420,00 €
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-400">MRR</span>
              <div className="text-sm font-bold text-indigo-400 font-mono">1.940,00 €</div>
            </div>
          </div>
        )}

        {/* 8. TOPOLOGY */}
        {visualization === "topology" && (
          <div className="h-16 w-full rounded-lg bg-zinc-100 dark:bg-[#0A0B0D] border border-zinc-200/70 dark:border-white/[0.04] p-2 flex items-center justify-center">
            <svg className="w-full h-full text-zinc-600" viewBox="0 0 160 50">
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

        {/* 9. PAGES */}
        {visualization === "pages" && (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between py-1 px-2 rounded-md bg-zinc-200/50 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate">
                  Product Blueprint 2026
                </span>
              </div>
              <span className="text-[10px] text-zinc-400">Hoje</span>
            </div>
            <div className="flex items-center justify-between py-1 px-2 rounded-md bg-zinc-200/50 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate">
                  Políticas de Segurança
                </span>
              </div>
              <span className="text-[10px] text-zinc-400">Ontem</span>
            </div>
          </div>
        )}

        {/* 10. TIMELINE */}
        {visualization === "timeline" && (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between py-1 px-2 rounded-md bg-zinc-200/50 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-zinc-800 dark:text-zinc-200 truncate">
                  Deploy v2.4 efetuado em Staging
                </span>
              </div>
              <span className="text-[10px] text-zinc-400">10m atrás</span>
            </div>
          </div>
        )}

        {/* 11. PROGRESS */}
        {visualization === "progress" && (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between font-medium">
              <span className="text-zinc-700 dark:text-zinc-300">Objetivo Trimestral</span>
              <span className="font-mono font-bold text-blue-500">78%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full w-[78%] transition-all" />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>Iniciado</span>
              <span>Meta: 100%</span>
            </div>
          </div>
        )}

        {/* 12. GAUGE */}
        {visualization === "gauge" && (
          <div className="flex flex-col items-center justify-center py-1">
            <div className="relative flex items-center justify-center">
              <svg className="w-24 h-14" viewBox="0 0 100 60">
                <path
                  d="M10 50 A40 40 0 0 1 90 50"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <path
                  d="M10 50 A40 40 0 0 1 76 22"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute bottom-0 text-center">
                <span className="text-lg font-bold font-mono text-zinc-900 dark:text-white">84%</span>
              </div>
            </div>
            <span className="text-[10px] text-zinc-400 mt-1 font-medium">Velocidade Operacional</span>
          </div>
        )}

        {/* 13. AGENDA */}
        {visualization === "agenda" && (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2 py-1 px-2 rounded-md bg-zinc-200/50 dark:bg-white/[0.04]">
              <div className="flex flex-col items-center justify-center px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-mono text-[9px] font-bold shrink-0">
                <span>QUI</span>
                <span>29</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">Sprint Review & Sync</p>
                <p className="text-[10px] text-zinc-400">14:30 — 15:30</p>
              </div>
            </div>
          </div>
        )}

        {/* 14. CARDS */}
        {visualization === "cards" && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-100/50 dark:bg-white/[0.02]">
              <span className="text-[10px] font-mono text-amber-400 uppercase">Decisão</span>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">PostgreSQL 16</p>
            </div>
            <div className="p-2 rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-100/50 dark:bg-white/[0.02]">
              <span className="text-[10px] font-mono text-emerald-400 uppercase">Projeto</span>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">Customizer V2</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Hint */}
      <div className="pt-2 border-t border-zinc-200/80 dark:border-white/[0.04] flex items-center justify-between text-[11px] text-zinc-400">
        <span>Formato: {visualization.toUpperCase()}</span>
        <span className="text-blue-500 font-medium flex items-center gap-1">
          <span>Tudo pronto</span>
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}
