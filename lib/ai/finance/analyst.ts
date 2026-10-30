import { SupabaseClient } from "@supabase/supabase-js";
import { getOrFetchStripeFinancialSnapshot } from "@/lib/integrations/stripe/analytics";
import { CurrencyFinancialTotals } from "@/lib/integrations/stripe/types";
import { VerifiedSource } from "../types";
import { logger } from "@/lib/security/logger";

export interface FormattedFinancialAnalysis {
  currency: string;
  activeMrr: number; // in unit currency (e.g. EUR / USD)
  arr: number; // in unit currency
  activeSubscribers: number;
  netRevenuePeriod: number;
  retentionRate?: number | null;
  churnRate?: number | null;
  isStripeConnected: boolean;
  sourceText: string;
}

export class AIFinancialAnalyst {
  /**
   * Retrieves and structures factual financial data from Stripe snapshot.
   * INVARIANT: Strictly read-only. Conflates zero estimates with facts.
   */
  static async getFinancialContext(
    supabase: SupabaseClient,
    organizationId: string
  ): Promise<{ source?: VerifiedSource; metrics?: FormattedFinancialAnalysis }> {
    try {
      const snapshotResult = await getOrFetchStripeFinancialSnapshot(
        supabase,
        organizationId
      );

      if (!snapshotResult || !snapshotResult.snapshot) {
        return {
          source: {
            id: "finance:stripe_metrics",
            type: "file",
            title: "Métricas Financeiras & Stripe",
            snippet: "Integração Stripe não conectada ou sem dados de faturação disponíveis para este workspace.",
            updatedAt: new Date().toISOString(),
          },
        };
      }

      const snapshot = snapshotResult.snapshot;
      const currency = snapshot.primaryCurrency || "EUR";
      const totals: CurrencyFinancialTotals | undefined = snapshot.currencies?.[currency];

      if (!totals) {
        return {
          source: {
            id: "finance:stripe_metrics",
            type: "file",
            title: "Métricas Financeiras & Stripe",
            snippet: `Sem dados registados na moeda principal (${currency}).`,
            updatedAt: snapshot.provenance?.lastSyncedAt || snapshot.computedAt,
          },
        };
      }

      const activeMrr = totals.activeMrrCents / 100;
      const arr = totals.arrCents / 100;
      const netRevenue = totals.netRevenueCents / 100;
      const grossRevenue = totals.grossRevenueCents / 100;
      const activeSubs = totals.activeSubscribersCount || 0;
      const retention = totals.retentionRatePercentage;
      const churn = totals.churnRatePercentage;

      const snippetLines = [
        `### INDICADORES FINANCEIROS CONTRATUAIS (FACTOS COMPROVADOS):`,
        `- Moeda: ${currency.toUpperCase()}`,
        `- MRR Ativo (Net Effective): ${currency.toUpperCase()} ${activeMrr.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`,
        `- Subscrições Ativas: ${activeSubs}`,
        `- Receita Líquida do Período (Net Revenue): ${currency.toUpperCase()} ${netRevenue.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`,
        `- Faturação Bruta do Período: ${currency.toUpperCase()} ${grossRevenue.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`,
        retention != null ? `- Taxa de Retenção: ${retention.toFixed(1)}%` : null,
        churn != null ? `- Taxa de Churn: ${churn.toFixed(1)}%` : null,
        ``,
        `### PROJEÇÕES MATEMÁTICAS & EXTRAPOLAÇÕES (ESTIMATIVAS):`,
        `- ARR (Run-Rate Anualizado = MRR × 12): ${currency.toUpperCase()} ${arr.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} (Exclui pagamentos pontuais e assume taxa de churn zero).`,
        `- Estado da Fonte: Dados verificados via Stripe Financial Snapshot (${snapshot.freshnessStatus}).`,
      ].filter(Boolean);

      const snippet = snippetLines.join("\n");

      return {
        metrics: {
          currency,
          activeMrr,
          arr,
          activeSubscribers: activeSubs,
          netRevenuePeriod: netRevenue,
          retentionRate: retention,
          churnRate: churn,
          isStripeConnected: true,
          sourceText: snippet,
        },
        source: {
          id: "finance:stripe_metrics",
          type: "file",
          title: "Métricas Financeiras & Stripe",
          snippet,
          url: "/dashboard/finance",
          updatedAt: snapshot.provenance?.lastSyncedAt || snapshot.computedAt,
        },
      };
    } catch (err: any) {
      logger.error("Failed to assemble financial context for AI", err);
      return {
        source: {
          id: "finance:stripe_metrics",
          type: "file",
          title: "Métricas Financeiras & Stripe",
          snippet: "Falha de conectividade ao consultar o snapshot financeiro da Stripe.",
          updatedAt: new Date().toISOString(),
        },
      };
    }
  }
}
