-- ==============================================================================
-- KogSync: API-First Architecture & Database Minimization
-- Migration: 00049_shopify_api_first_minimization.sql
-- ==============================================================================
-- Eliminates permanent database replication of external Shopify business data
-- (products, variants, inventory, locations, orders) in favor of direct,
-- server-side API queries with in-memory caching and request coalescing.
--
-- PRESERVED:
-- 1. public.organization_integrations (credentials, tokens, tenant association)
-- 2. public.shopify_webhook_events (lightweight delivery deduplication & GDPR audit)
-- 3. public.oauth_state_nonces (anti-replay cryptographic ledger)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. DROP UNNECESSARY REPLICATION TABLES
-- External Shopify data is authoritative on Shopify and queried directly via API.
-- ------------------------------------------------------------------------------

-- Drop child tables first to respect foreign keys
DROP TABLE IF EXISTS public.shopify_product_variants CASCADE;
DROP TABLE IF EXISTS public.shopify_inventory_levels CASCADE;

-- Drop parent data tables
DROP TABLE IF EXISTS public.shopify_products CASCADE;
DROP TABLE IF EXISTS public.shopify_orders CASCADE;
DROP TABLE IF EXISTS public.shopify_locations CASCADE;

-- ------------------------------------------------------------------------------
-- 2. RETAIN & OPTIMIZE LIGHTWEIGHT AUDIT LEDGER (shopify_webhook_events)
-- Used strictly for delivery deduplication (preventing duplicate processing)
-- and GDPR compliance proof (customers/data_request, customers/redact, shop/redact).
-- ------------------------------------------------------------------------------

-- Ensure shopify_webhook_events has cleanup index for TTL/bounded retention
CREATE INDEX IF NOT EXISTS idx_shopify_webhooks_created_at 
  ON public.shopify_webhook_events (created_at DESC);

COMMIT;
