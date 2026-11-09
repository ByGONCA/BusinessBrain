"use client";

// ==============================================================================
// KogSync: Shopify Integration View (Catalog, Orders & Commerce Intelligence)
// Directly backs UI from PostgreSQL local tables with real-time sync control
// ==============================================================================

import * as React from "react";
import {
  RefreshCw,
  LogOut,
  ShoppingBag,
  Package,
  Layers,
  Clock,
  Boxes,
  Database,
  CheckCircle2,
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
  triggerShopifySyncAction,
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
      totalVariantsCount: 0,
      totalOrdersCount: 0,
      totalInventoryCount: 0,
      syncStatus: "idle",
    }
  );
  const [activeTab, setActiveTab] = React.useState<"products" | "orders">("products");
  const [isLoading, setIsLoading] = React.useState(!initialSnapshot);
  const [isSyncing, setIsSyncing] = React.useState(false);
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
      setFeedback({ type: "error", text: "Falha ao carregar dados do KogSync." });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    if (!initialSnapshot) {
      loadSnapshot();
    }
  }, [initialSnapshot, loadSnapshot]);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await triggerShopifySyncAction(organizationId, false);
      if (res.success && res.result) {
        setFeedback({
          type: "success",
          text: `Sincronização concluída com sucesso (${res.result.itemsSynced} itens importados/atualizados).`,
        });
        await loadSnapshot();
      } else {
        setFeedback({
          type: "error",
          text: res.error || "Falha ao executar sincronização com a loja.",
        });
      }
    } catch {
      setFeedback({ type: "error", text: "Erro ao comunicar com o servidor de sincronização." });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setFeedback(null), 5000);
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
          totalVariantsCount: 0,
          totalOrdersCount: 0,
          totalInventoryCount: 0,
          syncStatus: "idle",
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

  const formattedLastSync = snapshot.lastSyncAt
    ? new Date(snapshot.lastSyncAt).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Nunca";

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
                {snapshot.syncStatus === "in_progress" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 rounded-md border border-blue-200 dark:border-blue-900/40">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                    A Sincronizar
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
                <span>• Última sincronização: {formattedLastSync}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncNow}
              disabled={isSyncing || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
              title="Executar sincronização de dados agora"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin text-[#95BF47]")} />
              <span>{isSyncing ? "A Sincronizar..." : "Sincronizar Agora"}</span>
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

        {/* Sync Error Banner if applicable */}
        {snapshot.lastSyncError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <span>Aviso de sincronização: {snapshot.lastSyncError}</span>
          </div>
        )}

        {/* Persistence Metrics Bar */}
        <div className="grid grid-cols-4 gap-3 px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30 text-xs">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-zinc-400" />
            <div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Produtos no KogSync</div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {snapshot.totalProductsCount}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-zinc-400" />
            <div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Variantes / SKUs</div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {snapshot.totalVariantsCount ?? 0}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-zinc-400" />
            <div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Encomendas Armazenadas</div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {snapshot.totalOrdersCount}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-zinc-400" />
            <div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Níveis de Inventário</div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {snapshot.totalInventoryCount ?? 0}
              </div>
            </div>
          </div>
        </div>

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
              <p className="text-xs">A carregar dados persistidos da loja Shopify...</p>
            </div>
          ) : activeTab === "products" ? (
            <div className="space-y-3">
              {snapshot.products.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-xs">
                  Nenhum produto persistido no momento. Clique em &quot;Sincronizar Agora&quot; para importar o catálogo.
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
                        <span>Estado: {product.status}</span>
                        {product.tags && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px]">Tags: {product.tags}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {product.variants[0] ? (
                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {product.variants[0].price} {snapshot.connectedAccount?.currency || "USD"}
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-400">Sincronizado</div>
                      )}
                      {product.handle && (
                        <div className="text-[11px] text-zinc-400 font-mono">
                          /{product.handle}
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
                  Nenhuma encomenda importada ainda. Clique em &quot;Sincronizar Agora&quot; para importar dados de vendas.
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
                        {order.created_at ? new Date(order.created_at).toLocaleDateString() : ""}
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
                Esta ação revogará o acesso à loja e eliminará as credenciais de sincronização deste espaço de trabalho. Os dados já sincronizados serão mantidos em segurança.
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
