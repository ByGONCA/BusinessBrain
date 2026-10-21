"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  CreditCard,
  Users,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  StripeFinancialSnapshot,
  MetricFreshnessStatus,
  CurrencyFinancialTotals,
} from "@/lib/integrations/stripe/analytics";
import { refreshStripeMetricsAction } from "@/lib/integrations/stripe/actions";
import { cn } from "@/lib/utils";

interface BusinessMetricsSectionProps {
  organizationId: string;
  userRole: "owner" | "admin" | "member" | "guest";
  initialSnapshot: StripeFinancialSnapshot | null;
  status: MetricFreshnessStatus;
  isStripeConnected: boolean;
  connectedAccountId?: string;
  errorMessage?: string;
}

function formatCents(amountCents: number, currency = "eur"): string {
  try {
    return (amountCents / 100).toLocaleString("pt-PT", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function BusinessMetricsSection({
  organizationId,
  userRole,
  initialSnapshot,
  status: initialStatus,
  isStripeConnected,
  connectedAccountId,
  errorMessage: initialErrorMessage,
}: BusinessMetricsSectionProps) {
  const [snapshot, setSnapshot] = useState<StripeFinancialSnapshot | null>(initialSnapshot);
  const [status, setStatus] = useState<MetricFreshnessStatus>(initialStatus);
  const [feedbackError, setFeedbackError] = useState<string | null>(initialErrorMessage || null);
  const [isPending, startTransition] = useTransition();

  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";

  const handleManualRefresh = () => {
    if (!isOwnerOrAdmin || isPending) return;

    setFeedbackError(null);
    startTransition(async () => {
      try {
        const res = await refreshStripeMetricsAction();
        if (!res.success) {
          setFeedbackError(res.error || "Falha ao atualizar dados.");
        } else {
          // Trigger optimistic sync status
          setStatus((res.data as { status: MetricFreshnessStatus })?.status || "fresh");
          window.location.reload();
        }
      } catch (err: unknown) {
        setFeedbackError(err instanceof Error ? err.message : "Erro ao contactar o servidor.");
      }
    });
  };

  // 1. Empty State: Stripe not connected
  if (!isStripeConnected || !snapshot) {
    return (
      <div className="rounded-xl border border-border/70 bg-card/60 p-5 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background/80 text-foreground">
              <CreditCard className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Métricas Financeiras Empresariais (Stripe)
                </h2>
                <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/40">
                  Não Conectado
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground max-w-xl">
                Conecte a conta Stripe da empresa via Stripe Connect (permissão estrita de leitura) para consultar MRR, ARR, Receita Líquida, Churn e Clientes Pagantes reais com proveniência verificável.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOwnerOrAdmin ? (
              <a
                href="/api/integrations/stripe/connect"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors shadow-sm"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>Conectar Stripe</span>
              </a>
            ) : (
              <span className="text-[11px] text-muted-foreground italic bg-muted/30 px-3 py-1.5 rounded-md border border-border/40">
                Aguardando conexão pelo proprietário ou administrador
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Active Currencies
  const currenciesList: CurrencyFinancialTotals[] = Object.values(snapshot.currencies);
  const primaryCurrency = snapshot.primaryCurrency || "eur";
  const primaryTotals = snapshot.currencies[primaryCurrency] || currenciesList[0] || {
    currency: primaryCurrency,
    activeMrrCents: 0,
    atRiskDunningMrrCents: 0,
    arrCents: 0,
    grossRevenueCents: 0,
    netRevenueCents: 0,
    totalRefundsCents: 0,
    openDisputesCents: 0,
    stripeFeesCents: 0,
    activeSubscribersCount: 0,
    atRiskSubscribersCount: 0,
  };

  // Status configuration badge
  const statusBadge = (() => {
    switch (status) {
      case "fresh":
        return {
          label: "Sincronizado",
          className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          icon: CheckCircle2,
        };
      case "stale":
        return {
          label: "Em Cache",
          className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          icon: Clock,
        };
      case "expired":
        return {
          label: "Desatualizado",
          className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
          icon: AlertTriangle,
        };
      case "syncing":
        return {
          label: "A Sincronizar",
          className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          icon: RefreshCw,
        };
      case "error":
      default:
        return {
          label: "Erro na API",
          className: "bg-red-500/10 text-red-400 border-red-500/20",
          icon: AlertCircle,
        };
    }
  })();

  const StatusIcon = statusBadge.icon;

  return (
    <div className="space-y-3.5">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/60 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Dados Empresariais Reais (Stripe)
              </h2>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border",
                  statusBadge.className
                )}
              >
                <StatusIcon className={cn("h-3 w-3", status === "syncing" && "animate-spin")} />
                {statusBadge.label}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Fonte direta: {snapshot.connectedAccountId} • Janela: Últimos 12 meses • Fuso: {snapshot.timezone}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {feedbackError && (
            <span className="text-[11px] text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 max-w-xs truncate">
              {feedbackError}
            </span>
          )}

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={!isOwnerOrAdmin || isPending}
            title={
              isOwnerOrAdmin
                ? "Forçar atualização dos dados junto da Stripe"
                : "Apenas proprietários e administradores podem forçar atualização de métricas"
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors shadow-2xs",
              isOwnerOrAdmin
                ? "hover:bg-hover hover:border-border/80 cursor-pointer"
                : "opacity-50 cursor-not-allowed"
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isPending && "animate-spin")} />
            <span>{isPending ? "A atualizar..." : "Atualizar"}</span>
          </button>
        </div>
      </div>

      {/* Pagination Safeguard Banner */}
      {snapshot.provenance?.hasMoreUnfetched && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            <strong>Aviso de Limite de Paginação:</strong> O volume de registos atingiu o limite de segurança da API da Stripe ({50 * 100} registos). Nem todos os registos históricos puderam ser agregados neste snapshot para prevenir timeouts.
          </span>
        </div>
      )}

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Active MRR */}
        <div className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">MRR Ativo (Efetivo)</span>
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-400">
              Contratado
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold tracking-tight text-foreground">
              {formatCents(primaryTotals.activeMrrCents, primaryTotals.currency)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{primaryTotals.activeSubscribersCount} subscrições ativas</span>
            {primaryTotals.discountSavingsMrrCents > 0 && (
              <span className="text-[10px] text-emerald-400 font-medium">
                -{formatCents(primaryTotals.discountSavingsMrrCents, primaryTotals.currency)} desc.
              </span>
            )}
          </div>
        </div>

        {/* Card 2: ARR */}
        <div className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">ARR Estimado</span>
            <span className="text-[10px] font-medium text-muted-foreground">MRR × 12</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold tracking-tight text-foreground">
              {formatCents(primaryTotals.arrCents, primaryTotals.currency)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Run-rate contratual anualizado
          </p>
        </div>

        {/* Card 3: Net Revenue 12m */}
        <div className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Receita Líquida (12m)</span>
            <span className="rounded-full bg-blue-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-blue-400">
              Liquidado
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold tracking-tight text-foreground">
              {formatCents(primaryTotals.netRevenueCents, primaryTotals.currency)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Deduzidos {formatCents(primaryTotals.totalRefundsCents, primaryTotals.currency)} de estornos
          </p>
        </div>

        {/* Card 4: Active Customers */}
        <div className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Clientes Pagantes</span>
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold tracking-tight text-foreground">
              {snapshot.totalActiveCustomersCount}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{primaryTotals.trialingSubscribersCount || 0} em trial</span>
            {primaryTotals.canceledSubscribersCount > 0 && (
              <span className="text-[10px] text-zinc-400">
                {primaryTotals.canceledSubscribersCount} cancelados
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Monthly History Mini-Chart / Trajectory View */}
      {snapshot.monthlyHistory && snapshot.monthlyHistory[primaryCurrency] && snapshot.monthlyHistory[primaryCurrency].length > 0 && (
        <div className="rounded-xl border border-border/80 bg-card/40 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-foreground">Trajetória de Receita Mensal Liquidada</h3>
              <p className="text-[10px] text-muted-foreground">Volume de cash-flow líquido mensal (últimos 12 meses)</p>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase">{primaryCurrency}</span>
          </div>
          <div className="flex items-end gap-1.5 h-20 pt-2 border-b border-border/50">
            {(() => {
              const points = snapshot.monthlyHistory[primaryCurrency];
              const maxNet = Math.max(...points.map((p) => Math.max(0, p.netRevenueCents)), 1);
              return points.map((p) => {
                const heightPercent = Math.max(8, Math.round((Math.max(0, p.netRevenueCents) / maxNet) * 100));
                return (
                  <div key={p.monthKey} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full rounded-t bg-blue-500/60 group-hover:bg-blue-400 transition-colors"
                    />
                    <div className="absolute -top-7 hidden group-hover:flex px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[9px] text-white whitespace-nowrap z-10 shadow-lg">
                      {p.monthKey}: {formatCents(p.netRevenueCents, primaryCurrency)}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
            <span>{snapshot.monthlyHistory[primaryCurrency][0]?.monthKey || ""}</span>
            <span>{snapshot.monthlyHistory[primaryCurrency][snapshot.monthlyHistory[primaryCurrency].length - 1]?.monthKey || ""}</span>
          </div>
        </div>
      )}

      {/* Dunning / At Risk Subscriptions Banner */}
      {primaryTotals.atRiskDunningMrrCents > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200/90 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300">
              MRR em Risco (Dunning): {formatCents(primaryTotals.atRiskDunningMrrCents, primaryTotals.currency)}
            </span>
            <span className="ml-1 text-[11px] text-amber-200/80">
              ({primaryTotals.atRiskSubscribersCount} subscrições com pagamento falhado em período de tolerância de {snapshot.dunningGracePeriodDays} dias).
              Apresentado separadamente: não inflaciona o MRR ativo.
            </span>
          </div>
        </div>
      )}

      {/* Multi-currency breakdown if multiple detected */}
      {currenciesList.length > 1 && (
        <div className="rounded-xl border border-border/80 bg-card/30 p-3.5">
          <span className="text-xs font-semibold text-foreground">
            Repartição por Moeda (Sem soma de moedas incompatíveis):
          </span>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {currenciesList.map((c) => (
              <div key={c.currency} className="rounded-lg border border-border/60 bg-background/50 p-2.5">
                <span className="font-semibold text-foreground uppercase">{c.currency}</span>:{" "}
                <span className="text-muted-foreground">
                  MRR: {formatCents(c.activeMrrCents, c.currency)} • Líquido: {formatCents(c.netRevenueCents, c.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Provenance footer */}
      <div className="flex flex-wrap items-center justify-between text-[10px] text-muted-foreground/80 pt-0.5 px-1">
        <span>
          Proveniência: Stripe Connect Standard • Payload: {snapshot.provenance.payloadSizeBytes} bytes
          {snapshot.provenance.safeguardPruned && " (Salvaguarda de 32 KB aplicada)"}
          {snapshot.provenance.pagesTraversedSubscriptions > 1 &&
            ` • Pág. Subscrições: ${snapshot.provenance.pagesTraversedSubscriptions}`}
          {snapshot.provenance.pagesTraversedBalanceTransactions > 1 &&
            ` • Pág. Transações: ${snapshot.provenance.pagesTraversedBalanceTransactions}`}
        </span>
        <span>
          Última consulta: {new Date(snapshot.computedAt).toLocaleString("pt-PT")}
        </span>
      </div>
    </div>
  );
}
