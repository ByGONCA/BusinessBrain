"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Zap,
  Gauge,
  Clock,
  Sparkles,
  ExternalLink,
  Layers,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { getAccountAILimitsAction, AccountAILimitsData } from "@/lib/ai/auth/actions";

interface AccountLimitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLimits?: AccountAILimitsData | null;
}

export function AccountLimitsModal({ isOpen, onClose, initialLimits }: AccountLimitsModalProps) {
  const { locale } = useLanguage();
  const isPt = locale === "pt";
  const router = useRouter();

  const [limits, setLimits] = React.useState<AccountAILimitsData | null>(initialLimits || null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (initialLimits) {
      setLimits(initialLimits);
    }
  }, [initialLimits]);

  React.useEffect(() => {
    if (isOpen) {
      if (!initialLimits) setIsLoading(true);
      getAccountAILimitsAction().then((res) => {
        setIsLoading(false);
        if (res.success && res.limits) {
          setLimits(res.limits);
        }
      });
    }
  }, [isOpen, initialLimits]);

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tier = limits?.tier || "starter";
  const quota = limits?.monthlyQuota || 1000;
  const used = limits?.usedCredits || 0;
  const percentage = Math.min(100, Math.round((used / quota) * 100));

  const planDisplayName: Record<string, string> = {
    trial: isPt ? "Período de Teste" : "Trial Period",
    starter: "Starter",
    pro: "Pro",
    enterprise: "Enterprise",
  };

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 cursor-pointer text-left"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left cursor-default animate-in zoom-in-95 duration-100"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-card/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground tracking-tight">
                {isPt ? "Limites da Conta & Quota de IA" : "Account Limits & AI Quota"}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {isPt
                  ? "Capacidade e consumos autorizados para o seu plano atual."
                  : "Authorized capacity and limits for your active workspace plan."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>{isPt ? "A carregar limites da conta..." : "Loading account limits..."}</span>
            </div>
          ) : (
            <>
              {/* Plan Badge Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface-secondary/80">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                    {isPt ? "Plano Ativo" : "Active Plan"}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-semibold text-foreground capitalize">
                      {planDisplayName[tier] || tier}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.2 rounded-md">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {isPt ? "Ativo" : "Active"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push("/dashboard/billing");
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white px-2.5 py-1.5 rounded-lg border border-border hover:border-border-strong bg-surface-secondary/50 hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                  <span>{isPt ? "Planos & Faturação" : "Plans & Billing"}</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </button>
              </div>

              {/* Monthly Credit Quota Progress */}
              <div className="space-y-1.5 p-3 rounded-xl border border-border bg-surface-secondary">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                    <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                    {isPt ? "Quota Mensal de Créditos" : "Monthly Credit Quota"}
                  </span>
                  <span className="font-mono text-muted-foreground font-semibold">
                    {used.toLocaleString()} / {quota.toLocaleString()}{" "}
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {isPt ? "créditos" : "credits"}
                    </span>
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      percentage >= 90
                        ? "bg-rose-500"
                        : percentage >= 75
                        ? "bg-amber-500"
                        : "bg-emerald-400"
                    }`}
                    style={{ width: `${Math.max(4, percentage)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                  <span>{percentage}% {isPt ? "utilizado no ciclo" : "consumed this cycle"}</span>
                  <span>{isPt ? "1 crédito ≈ 1.000 tokens" : "1 credit ≈ 1,000 tokens"}</span>
                </div>
              </div>

              {/* Technical Limits Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Max Tokens */}
                <div className="p-3 rounded-xl border border-white/[0.05] bg-surface-secondary/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                    <Layers className="h-3 w-3 text-muted-foreground" />
                    <span>{isPt ? "Tokens por Pedido" : "Tokens per Request"}</span>
                  </div>
                  <p className="font-mono text-sm font-semibold text-zinc-200">
                    {(limits?.maxTokensPerRequest || 4096).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isPt ? "Limite de saída por resposta" : "Max completion tokens"}
                  </p>
                </div>

                {/* Rate Limit */}
                <div className="p-3 rounded-xl border border-white/[0.05] bg-surface-secondary/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{isPt ? "Pedidos por Minuto" : "Rate Limit"}</span>
                  </div>
                  <p className="font-mono text-sm font-semibold text-zinc-200">
                    {limits?.rateLimitPerMinute || 15} req/min
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isPt ? "Capacidade concorrente" : "Burst concurrency ceiling"}
                  </p>
                </div>

                {/* Context Window */}
                <div className="p-3 rounded-xl border border-white/[0.05] bg-surface-secondary/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                    <Sparkles className="h-3 w-3 text-muted-foreground" />
                    <span>{isPt ? "Janela de Contexto" : "Context Window"}</span>
                  </div>
                  <p className="font-mono text-sm font-semibold text-zinc-200">
                    1.048.576
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isPt ? "Memória por sessão" : "Tokens per session"}
                  </p>
                </div>

                {/* Deep Reasoning */}
                <div className="p-3 rounded-xl border border-white/[0.05] bg-surface-secondary/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                    <Zap className="h-3 w-3 text-amber-400" />
                    <span>{isPt ? "Raciocínio Profundo" : "Deep Reasoning"}</span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-200">
                    {limits?.supportsDeepReasoning
                      ? isPt ? "Disponível" : "Enabled"
                      : isPt ? "Requer Pro" : "Pro Required"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isPt ? "Modelos de reflexão avançada" : "Advanced chain-of-thought"}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-card/60 flex items-center justify-between text-xs">
          <span className="text-[11px] text-muted-foreground">
            {isPt ? "Renovação automática a cada ciclo de faturação." : "Auto-renews at every monthly billing cycle."}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-white/[0.05] text-muted-foreground hover:text-white transition-colors cursor-pointer"
          >
            {isPt ? "Fechar" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
