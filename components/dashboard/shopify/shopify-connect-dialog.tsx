"use client";

// ==============================================================================
// KogSync: Shopify Connect Store Domain Input Dialog
// ==============================================================================

import * as React from "react";
import { ShoppingBag, ArrowRight, X, AlertCircle } from "lucide-react";

interface ShopifyConnectDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShopifyConnectDialog({ isOpen, onClose }: ShopifyConnectDialogProps) {
  const [storeDomain, setStoreDomain] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let clean = storeDomain.trim().toLowerCase();
    clean = clean.replace(/^https?:\/\//i, "").split("/")[0].split("?")[0].split(":")[0];

    if (!clean) {
      setError("Por favor, introduza o domínio da sua loja Shopify.");
      return;
    }

    if (!clean.includes(".")) {
      clean = `${clean}.myshopify.com`;
    }

    // Strict validation
    const domainRegex = /^[a-z0-9][a-z0-9\-]{2,59}\.myshopify\.com$/;
    if (!domainRegex.test(clean)) {
      setError("Formato de domínio inválido. Exemplo: nome-da-loja.myshopify.com");
      return;
    }

    setIsSubmitting(true);
    window.location.href = `/api/integrations/shopify/connect?shop=${encodeURIComponent(clean)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#95BF47]/10 text-[#95BF47] border border-[#95BF47]/20">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Conectar Loja Shopify
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                OAuth 2.0 Multiempresa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Domínio da Loja (.myshopify.com)
            </label>
            <div className="relative">
              <input
                type="text"
                value={storeDomain}
                onChange={(e) => {
                  setStoreDomain(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="exemplo-loja.myshopify.com"
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-[#95BF47]/40 focus:border-[#95BF47] transition-all"
                autoFocus
              />
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              Pode introduzir apenas o identificador da loja ou o endereço completo.
            </p>
          </div>

          {/* Scopes Explanation */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/40 text-xs text-zinc-600 dark:text-zinc-300 space-y-1">
            <span className="font-medium text-zinc-900 dark:text-zinc-200 block">
              Permissões solicitadas (Leitura Estrita):
            </span>
            <ul className="list-disc list-inside text-[11px] text-zinc-500 dark:text-zinc-400 space-y-0.5">
              <li>Catálogo de produtos e variantes</li>
              <li>Níveis e localizações de inventário</li>
              <li>Métricas de encomendas e receitas executivas</li>
            </ul>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !storeDomain.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#95BF47] hover:bg-[#86ac3e] rounded-xl shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <span>{isSubmitting ? "A redirecionar..." : "Continuar para a Shopify"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
