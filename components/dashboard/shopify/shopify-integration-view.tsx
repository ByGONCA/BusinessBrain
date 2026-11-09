"use client";

// ==============================================================================
// KogSync: Shopify Integration View (Catalog, Orders & Commerce Intelligence)
// ==============================================================================

import * as React from "react";
import {
  ExternalLink,
  RefreshCw,
  LogOut,
  ShoppingBag,
  Package,
  Layers,
  Clock,
  ShieldCheck,
  ChevronRight,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ShopifyWorkspaceSnapshot,
  ShopifyProduct,
  ShopifyOrder,
} from "@/lib/integrations/shopify/types";
import {
  getShopifyWorkspaceSnapshotAction,
  disconnectShopifyAction,
} from "@/lib/integrations/shopify/actions";

interface ShopifyIntegrationViewProps {
  initialSnapshot?: ShopifyWorkspaceSnapshot;
  organizationId?: string;
  onClose?: () => void;
}

export function ShopifyIntegrationView({
  initialSnapshot,
  organizationId,
  onClose,
}: ShopifyIntegrationViewProps) {
  const [snapshot, setSnapshot] = React.useState<ShopifyWorkspaceSnapshot>(
    initialSnapshot || {
      status: "disconnected",
      products: [],
      recentOrders: [],
      totalProductsCount: 0,
      totalOrdersCount: 0,
    }
  );
  const [activeTab, setActiveTab] = React.useState<"products" | "orders">("products");
  const [isLoading, setIsLoading] = React.useState(!initialSnapshot);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadSnapshot = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getShopifyWorkspaceSnapshotAction(organizationId);
      if (res.success && res.data) {
        setSnapshot(res.data);
      } else if (res.error) {
        setFeedback({ type: "error", text: res.error });
      }
    } catch {
      setFeedback({ type: "error", text: "Falha ao contactar a Shopify." });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    if (!initialSnapshot) {
      loadSnapshot();
    }
  }, [initialSnapshot, loadSnapshot]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setFeedback(null);
    try {
      const res = await getShopifyWorkspaceSnapshotAction(organizationId);
      if (res.success && res.data) {
        setSnapshot(res.data);
        setFeedback({ type: "success", text: "Catálogo e encomendas sincronizados." });
      } else {
        setFeedback({ type: "error", text: res.error || "Falha ao sincronizar." });
      }
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await disconnectShopifyAction(organizationId);
      if (res.success) {
        setSnapshot({
          status: "disconnected",
          products: [],
          recentOrders: [],
          totalProductsCount: 0,
          totalOrdersCount: 0,
        });
        setFeedback({ type: "success", text: "Shopify desligada com sucesso." });
        setShowConfirmDisconnect(false);

        // Notify parent settings modal
        window.dispatchEvent(
          new CustomEvent("integration-status-change", {
            detail: { provider: "shopify", status: "disconnected" },
          })
        );
      } else {
        setFeedback({ type: "error", text: res.error || "Falha ao desligar loja." });
      }
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#95BF47]/10 text-[#95BF47] border border-[#95BF47]/20">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {snapshot.connectedAccount?.shopName || "Loja Shopify"}
                </h3>
                {snapshot.status === "connected" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-md border border-emerald-200 dark:border-emerald-900/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Ligada
                  </span>
                )}
                {snapshot.status === "needs_reauth" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-md border border-amber-200 dark:border-amber-900/40">
                    Reautenticação Necessária
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                <span>{snapshot.connectedAccount?.shopDomain}</span>
                {snapshot.connectedAccount?.currency && (
                  <span>• Moeda: {snapshot.connectedAccount.currency}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              title="Sincronizar dados"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </button>
            <button
              onClick={() => setShowConfirmDisconnect(true)}
              className="p-2 text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title="Desligar Shopify"
            >
              <LogOut className="h-4 w-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={cn(
              "px-6 py-2.5 text-xs font-medium border-b",
              feedback.type === "success"
                ? "bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-900/40"
                : "bg-rose-50/80 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-900/40"
            )}
          >
            {feedback.text}
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex items-center gap-4 px-6 pt-3 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab("products")}
            className={cn(
              "flex items-center gap-2 pb-2.5 text-xs font-medium border-b-2 transition-colors",
              activeTab === "products"
                ? "text-zinc-900 dark:text-zinc-100 border-[#95BF47]"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 border-transparent"
            )}
          >
            <Package className="h-3.5 w-3.5" />
            <span>Produtos ({snapshot.products.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={cn(
              "flex items-center gap-2 pb-2.5 text-xs font-medium border-b-2 transition-colors",
              activeTab === "orders"
                ? "text-zinc-900 dark:text-zinc-100 border-[#95BF47]"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 border-transparent"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Encomendas ({snapshot.recentOrders.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
              <RefreshCw className="h-6 w-6 animate-spin mb-3 text-[#95BF47]" />
              <p className="text-xs">A carregar telemetria da loja Shopify...</p>
            </div>
          ) : activeTab === "products" ? (
            <div className="space-y-3">
              {snapshot.products.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-xs">
                  Nenhum produto encontrado nesta loja.
                </div>
              ) : (
                snapshot.products.map((product) => (
                  <div
                    key={product.id}
                    className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-800/20 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {product.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="capitalize">{product.vendor || "Geral"}</span>
                        <span>•</span>
                        <span>{product.variants.length} variante(s)</span>
                        <span>•</span>
                        <span>Estado: {product.status}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {product.variants[0] && (
                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {product.variants[0].price} {snapshot.connectedAccount?.currency || "USD"}
                        </div>
                      )}
                      {product.variants[0]?.sku && (
                        <div className="text-[11px] text-zinc-400 font-mono">
                          SKU: {product.variants[0].sku}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {snapshot.recentOrders.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-xs">
                  Nenhuma encomenda recente registada.
                </div>
              ) : (
                snapshot.recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-800/20 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {order.name}
                        </span>
                        <span
                          className={cn(
                            "px-2 py-0.5 text-[10px] font-medium rounded-md uppercase tracking-wider",
                            order.financial_status === "paid"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
                              : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40"
                          )}
                        >
                          {order.financial_status}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        {order.line_items.length} artigo(s) •{" "}
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {order.current_total_price} {order.currency}
                      </div>
                      <div className="text-[11px] text-zinc-400 capitalize">
                        {order.fulfillment_status || "Não enviado"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Confirmation Modal for Disconnect */}
        {showConfirmDisconnect && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="w-full max-w-sm p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-4">
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-5 w-5" />
                <h4 className="text-sm font-semibold">Desligar Loja Shopify?</h4>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Esta ação revogará o acesso à loja e eliminará as credenciais de sincronização deste espaço de trabalho.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmDisconnect(false)}
                  disabled={isDisconnecting}
                  className="px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isDisconnecting ? "A desligar..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
