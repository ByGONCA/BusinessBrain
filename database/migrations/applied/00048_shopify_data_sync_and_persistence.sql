-- ==============================================================================
-- KogSync: Shopify Data Synchronization, Persistence & Webhook Ingestion Schema
-- Migration: 00048_shopify_data_sync_and_persistence.sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. TABLE: public.shopify_products
-- Canonical catalogue of products synced from connected Shopify stores.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopify_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.organization_integrations(id) ON DELETE SET NULL,
  shopify_product_id text NOT NULL,
  title text NOT NULL,
  handle text,
  body_html text,
  vendor text,
  product_type text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
  published_at timestamptz,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  shopify_created_at timestamptz,
  shopify_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_shopify_products_org_product UNIQUE (organization_id, shopify_product_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_products_org_id 
  ON public.shopify_products (organization_id);

CREATE INDEX IF NOT EXISTS idx_shopify_products_org_status 
  ON public.shopify_products (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_shopify_products_org_vendor 
  ON public.shopify_products (organization_id, vendor);

CREATE INDEX IF NOT EXISTS idx_shopify_products_org_updated 
  ON public.shopify_products (organization_id, shopify_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_shopify_products_integration 
  ON public.shopify_products (integration_id);

ALTER TABLE public.shopify_products ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_shopify_products_updated_at ON public.shopify_products;
CREATE TRIGGER set_shopify_products_updated_at
  BEFORE UPDATE ON public.shopify_products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2. TABLE: public.shopify_product_variants
-- Granular variants (SKU, price, barcode, inventory item mapping).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopify_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.shopify_products(id) ON DELETE CASCADE,
  shopify_product_id text NOT NULL,
  shopify_variant_id text NOT NULL,
  title text NOT NULL,
  sku text,
  price numeric(12, 2) NOT NULL DEFAULT 0.00,
  compare_at_price numeric(12, 2),
  position integer NOT NULL DEFAULT 1,
  inventory_item_id text,
  inventory_quantity integer NOT NULL DEFAULT 0,
  inventory_policy text NOT NULL DEFAULT 'deny',
  requires_shipping boolean NOT NULL DEFAULT true,
  barcode text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  shopify_created_at timestamptz,
  shopify_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_shopify_variants_org_variant UNIQUE (organization_id, shopify_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_variants_org_product 
  ON public.shopify_product_variants (organization_id, product_id);

CREATE INDEX IF NOT EXISTS idx_shopify_variants_org_inv_item 
  ON public.shopify_product_variants (organization_id, inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_shopify_variants_org_sku 
  ON public.shopify_product_variants (organization_id, sku);

ALTER TABLE public.shopify_product_variants ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_shopify_product_variants_updated_at ON public.shopify_product_variants;
CREATE TRIGGER set_shopify_product_variants_updated_at
  BEFORE UPDATE ON public.shopify_product_variants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. TABLE: public.shopify_locations
-- Physical/virtual fulfillment centers and warehouses registered in Shopify.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopify_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.organization_integrations(id) ON DELETE SET NULL,
  shopify_location_id text NOT NULL,
  name text NOT NULL,
  address1 text,
  address2 text,
  city text,
  province text,
  province_code text,
  country text,
  country_code text,
  zip text,
  phone text,
  active boolean NOT NULL DEFAULT true,
  is_primary boolean NOT NULL DEFAULT false,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_shopify_locations_org_location UNIQUE (organization_id, shopify_location_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_locations_org_active 
  ON public.shopify_locations (organization_id, active);

CREATE INDEX IF NOT EXISTS idx_shopify_locations_integration 
  ON public.shopify_locations (integration_id);

ALTER TABLE public.shopify_locations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_shopify_locations_updated_at ON public.shopify_locations;
CREATE TRIGGER set_shopify_locations_updated_at
  BEFORE UPDATE ON public.shopify_locations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 4. TABLE: public.shopify_inventory_levels
-- Matrix of stock levels per inventory item and location.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopify_inventory_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shopify_inventory_item_id text NOT NULL,
  shopify_location_id text NOT NULL,
  location_id uuid REFERENCES public.shopify_locations(id) ON DELETE CASCADE,
  available integer,
  on_hand integer,
  committed integer,
  reserved integer,
  shopify_updated_at timestamptz,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_shopify_inventory_item_location UNIQUE (organization_id, shopify_inventory_item_id, shopify_location_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_inventory_org_item 
  ON public.shopify_inventory_levels (organization_id, shopify_inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_shopify_inventory_org_loc 
  ON public.shopify_inventory_levels (organization_id, shopify_location_id);

CREATE INDEX IF NOT EXISTS idx_shopify_inventory_location_fk 
  ON public.shopify_inventory_levels (location_id);

ALTER TABLE public.shopify_inventory_levels ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_shopify_inventory_levels_updated_at ON public.shopify_inventory_levels;
CREATE TRIGGER set_shopify_inventory_levels_updated_at
  BEFORE UPDATE ON public.shopify_inventory_levels
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 5. TABLE: public.shopify_orders
-- Orders, financial totals and fulfillment lifecycles (Zero PII).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopify_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.organization_integrations(id) ON DELETE SET NULL,
  shopify_order_id text NOT NULL,
  order_number integer,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  financial_status text NOT NULL CHECK (financial_status IN ('pending', 'authorized', 'partially_paid', 'paid', 'partially_refunded', 'refunded', 'voided')),
  fulfillment_status text CHECK (fulfillment_status IN ('fulfilled', 'partial', 'unfulfilled', 'restocked')),
  subtotal_price numeric(12, 2) NOT NULL DEFAULT 0.00,
  total_tax numeric(12, 2) NOT NULL DEFAULT 0.00,
  total_discounts numeric(12, 2) NOT NULL DEFAULT 0.00,
  total_shipping numeric(12, 2) NOT NULL DEFAULT 0.00,
  total_price numeric(12, 2) NOT NULL DEFAULT 0.00,
  line_items_count integer NOT NULL DEFAULT 0,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  shopify_created_at timestamptz NOT NULL,
  shopify_updated_at timestamptz NOT NULL,
  cancelled_at timestamptz,
  cancel_reason text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_shopify_orders_org_order UNIQUE (organization_id, shopify_order_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_org_created 
  ON public.shopify_orders (organization_id, shopify_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_org_financial 
  ON public.shopify_orders (organization_id, financial_status);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_org_fulfillment 
  ON public.shopify_orders (organization_id, fulfillment_status);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_integration 
  ON public.shopify_orders (integration_id);

ALTER TABLE public.shopify_orders ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_shopify_orders_updated_at ON public.shopify_orders;
CREATE TRIGGER set_shopify_orders_updated_at
  BEFORE UPDATE ON public.shopify_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 6. TABLE: public.shopify_webhook_events
-- Ingress audit log and replay protection ledger for Shopify webhooks.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopify_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.organization_integrations(id) ON DELETE SET NULL,
  delivery_id text NOT NULL,
  topic text NOT NULL,
  shop_domain text NOT NULL,
  api_version text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'ignored')),
  attempts integer NOT NULL DEFAULT 1,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_shopify_webhooks_delivery UNIQUE (delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_webhooks_org_created 
  ON public.shopify_webhook_events (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shopify_webhooks_org_topic_status 
  ON public.shopify_webhook_events (organization_id, topic, status);

CREATE INDEX IF NOT EXISTS idx_shopify_webhooks_shop_domain 
  ON public.shopify_webhook_events (shop_domain);

ALTER TABLE public.shopify_webhook_events ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY POLICIES
-- ------------------------------------------------------------------------------

-- 7.1. Products
DROP POLICY IF EXISTS "Members can view shopify products" ON public.shopify_products;
CREATE POLICY "Members can view shopify products"
  ON public.shopify_products FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Admins can manage shopify products" ON public.shopify_products;
CREATE POLICY "Admins can manage shopify products"
  ON public.shopify_products FOR ALL
  USING (public.has_org_role(organization_id, array['owner', 'admin']))
  WITH CHECK (public.has_org_role(organization_id, array['owner', 'admin']));

-- 7.2. Product Variants
DROP POLICY IF EXISTS "Members can view shopify variants" ON public.shopify_product_variants;
CREATE POLICY "Members can view shopify variants"
  ON public.shopify_product_variants FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Admins can manage shopify variants" ON public.shopify_product_variants;
CREATE POLICY "Admins can manage shopify variants"
  ON public.shopify_product_variants FOR ALL
  USING (public.has_org_role(organization_id, array['owner', 'admin']))
  WITH CHECK (public.has_org_role(organization_id, array['owner', 'admin']));

-- 7.3. Locations
DROP POLICY IF EXISTS "Members can view shopify locations" ON public.shopify_locations;
CREATE POLICY "Members can view shopify locations"
  ON public.shopify_locations FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Admins can manage shopify locations" ON public.shopify_locations;
CREATE POLICY "Admins can manage shopify locations"
  ON public.shopify_locations FOR ALL
  USING (public.has_org_role(organization_id, array['owner', 'admin']))
  WITH CHECK (public.has_org_role(organization_id, array['owner', 'admin']));

-- 7.4. Inventory Levels
DROP POLICY IF EXISTS "Members can view shopify inventory" ON public.shopify_inventory_levels;
CREATE POLICY "Members can view shopify inventory"
  ON public.shopify_inventory_levels FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Admins can manage shopify inventory" ON public.shopify_inventory_levels;
CREATE POLICY "Admins can manage shopify inventory"
  ON public.shopify_inventory_levels FOR ALL
  USING (public.has_org_role(organization_id, array['owner', 'admin']))
  WITH CHECK (public.has_org_role(organization_id, array['owner', 'admin']));

-- 7.5. Orders
DROP POLICY IF EXISTS "Members can view shopify orders" ON public.shopify_orders;
CREATE POLICY "Members can view shopify orders"
  ON public.shopify_orders FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Admins can manage shopify orders" ON public.shopify_orders;
CREATE POLICY "Admins can manage shopify orders"
  ON public.shopify_orders FOR ALL
  USING (public.has_org_role(organization_id, array['owner', 'admin']))
  WITH CHECK (public.has_org_role(organization_id, array['owner', 'admin']));

-- 7.6. Webhook Events (Audit view for Admins)
DROP POLICY IF EXISTS "Admins can view shopify webhook events" ON public.shopify_webhook_events;
CREATE POLICY "Admins can view shopify webhook events"
  ON public.shopify_webhook_events FOR SELECT
  USING (public.has_org_role(organization_id, array['owner', 'admin']));

-- ------------------------------------------------------------------------------
-- 8. HELPER SECURITY DEFINER RPC: record_shopify_webhook_event
-- Atomically checks delivery_id uniqueness and records webhook receipt.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_shopify_webhook_event(
  p_delivery_id text,
  p_org_id uuid,
  p_integration_id uuid,
  p_topic text,
  p_shop_domain text,
  p_api_version text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.shopify_webhook_events (
    organization_id,
    integration_id,
    delivery_id,
    topic,
    shop_domain,
    api_version,
    payload,
    status
  ) VALUES (
    p_org_id,
    p_integration_id,
    p_delivery_id,
    p_topic,
    p_shop_domain,
    p_api_version,
    p_payload,
    'pending'
  )
  ON CONFLICT (delivery_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'code', 'RECORDED', 'event_id', v_event_id);
  ELSE
    RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_DELIVERY', 'message', 'Webhook delivery already recorded');
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. EXPLICIT PRIVILEGES (Compliance with Migration 00034)
-- ------------------------------------------------------------------------------

REVOKE ALL ON TABLE public.shopify_products FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shopify_products TO authenticated;
GRANT ALL ON TABLE public.shopify_products TO service_role;

REVOKE ALL ON TABLE public.shopify_product_variants FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shopify_product_variants TO authenticated;
GRANT ALL ON TABLE public.shopify_product_variants TO service_role;

REVOKE ALL ON TABLE public.shopify_locations FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shopify_locations TO authenticated;
GRANT ALL ON TABLE public.shopify_locations TO service_role;

REVOKE ALL ON TABLE public.shopify_inventory_levels FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shopify_inventory_levels TO authenticated;
GRANT ALL ON TABLE public.shopify_inventory_levels TO service_role;

REVOKE ALL ON TABLE public.shopify_orders FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shopify_orders TO authenticated;
GRANT ALL ON TABLE public.shopify_orders TO service_role;

REVOKE ALL ON TABLE public.shopify_webhook_events FROM public, anon;
GRANT SELECT ON TABLE public.shopify_webhook_events TO authenticated;
GRANT ALL ON TABLE public.shopify_webhook_events TO service_role;

REVOKE ALL ON FUNCTION public.record_shopify_webhook_event(text, uuid, uuid, text, text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_shopify_webhook_event(text, uuid, uuid, text, text, text, jsonb) TO service_role;

COMMIT;
