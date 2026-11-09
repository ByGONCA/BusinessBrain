// ==============================================================================
// KogSync: Multi-Tenant Shopify Integration TypeScript Contracts
// ==============================================================================

export interface ShopifyShop {
  id: number;
  name: string;
  email: string;
  domain: string;
  myshopify_domain: string;
  currency: string;
  money_format: string;
  iana_timezone: string;
  timezone: string;
  country_name: string;
  country_code: string;
  plan_name: string;
  created_at: string;
  updated_at: string;
}

export interface ShopifyProductVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string | null;
  position: number;
  inventory_policy: string;
  compare_at_price: string | null;
  inventory_item_id: number;
  inventory_quantity: number;
  requires_shipping: boolean;
}

export interface ShopifyProductImage {
  id: number;
  product_id: number;
  src: string;
  alt: string | null;
  width: number;
  height: number;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  created_at: string;
  handle: string;
  updated_at: string;
  published_at: string | null;
  status: "active" | "archived" | "draft";
  variants: ShopifyProductVariant[];
  images: ShopifyProductImage[];
  tags: string;
}

export interface ShopifyOrderLineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  sku: string | null;
  variant_title: string | null;
}

export interface ShopifyOrder {
  id: number;
  name: string; // e.g. "#1001"
  order_number: number;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  financial_status: "pending" | "authorized" | "partially_paid" | "paid" | "partially_refunded" | "refunded" | "voided";
  fulfillment_status: "fulfilled" | "partial" | "unfulfilled" | null;
  currency: string;
  current_total_price: string;
  subtotal_price: string;
  total_tax: string;
  line_items: ShopifyOrderLineItem[];
}

export interface ShopifyLocation {
  id: number;
  name: string;
  address1?: string;
  city?: string;
  country?: string;
  active: boolean;
}

export interface ShopifyInventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number | null;
  updated_at: string;
}

/**
 * State payload encrypted/signed into HMAC-SHA256 OAuth state.
 */
export interface ShopifyOAuthStatePayload {
  organizationId: string;
  userId: string;
  shop: string;
  nonce: string;
  timestamp: number;
  returnUrl?: string;
}

/**
 * Persisted in public.organization_integrations.metadata JSONB column.
 */
export interface ShopifyIntegrationMetadata {
  shop_id?: number;
  shop_domain: string;
  shop_name?: string;
  currency?: string;
  money_format?: string;
  iana_timezone?: string;
  country_code?: string;
  plan_name?: string;
  connected_user_id?: string;
  connected_user_email?: string;
  last_synced_at?: string;
  scopes?: string[];
  product_count?: number;
}

/**
 * Executive snapshot presented to merchant dashboard (ZERO tokens).
 */
export interface ShopifyWorkspaceSnapshot {
  status: "connected" | "disconnected" | "error" | "needs_reauth";
  connectedAccount?: {
    shopDomain: string;
    shopName?: string;
    email?: string;
    currency?: string;
    country?: string;
    connectedAt: string;
  };
  products: ShopifyProduct[];
  recentOrders: ShopifyOrder[];
  totalProductsCount: number;
  totalOrdersCount: number;
  lastSyncAt?: string;
}

export interface ShopifyTokenExchangeResult {
  access_token: string;
  scope: string;
  associated_user_scope?: string;
  associated_user?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    account_owner: boolean;
  };
}
