-- ==============================================================================
-- KogSync: Multi-Tenant Shopify Integration & Cross-Tenant Hijacking Defense
-- Migration: 00047_shopify_integration_security.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UNIQUE INDEX: idx_shopify_active_shop_unique
-- Enforces that a given Shopify store (*.myshopify.com) cannot be simultaneously
-- connected to more than one active organization in KogSync.
-- Prevents cross-tenant claiming/hijacking of existing merchant installations.
-- ------------------------------------------------------------------------------
create unique index if not exists idx_shopify_active_shop_unique
  on public.organization_integrations (provider_account_id)
  where (provider = 'shopify' and status = 'connected');

-- ------------------------------------------------------------------------------
-- 2. INDEX: Performance optimization for shop domain lookups during webhooks
-- ------------------------------------------------------------------------------
create index if not exists idx_shopify_provider_account_id
  on public.organization_integrations (provider, provider_account_id);
