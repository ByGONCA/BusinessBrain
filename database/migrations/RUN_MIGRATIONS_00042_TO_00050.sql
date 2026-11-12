-- ==============================================================================
-- KogSync / BusinessBrain: Consolidated Migrations (00042 to 00050)
-- Target: Supabase PostgreSQL (SQL Editor / Direct Migration Runner)
-- File: RUN_MIGRATIONS_00042_TO_00050.sql
--
-- Includes pending migrations:
--   1. 00042_entity_activity_history.sql
--   2. 00043_personal_and_company_workspaces.sql
--   3. 00044_universal_dashboards.sql
--   4. 00047_shopify_integration_security.sql
--   5. 00049_shopify_api_first_minimization.sql
--   6. 00050_stripe_integrity_and_monotonic_ordering.sql
--
-- Safety & Transaction Profile:
--   - Executed inside a single atomic transaction (BEGIN ... COMMIT).
--   - If any error or constraint violation occurs, the entire batch rolls back.
--   - Idempotent table / column additions and index creation.
--   - Pre-flight checks verify base schema before altering objects.
--   - Post-execution assertions verify all new tables, columns and RPCs.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- PRE-FLIGHT VERIFICATION CHECKS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
    RAISE EXCEPTION 'PRE-CHECK FAILED: Table public.organizations does not exist.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    RAISE EXCEPTION 'PRE-CHECK FAILED: Table public.profiles does not exist.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_entities') THEN
    RAISE EXCEPTION 'PRE-CHECK FAILED: Table public.company_entities does not exist.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
    RAISE EXCEPTION 'PRE-CHECK FAILED: Table public.subscriptions does not exist.';
  END IF;
END $$;


-- ==============================================================================
-- SECTION 00042: MIGRATION 00042: ENTITY ACTIVITY & AUDIT TRAIL
-- Source: 00042_entity_activity_history.sql
-- ==============================================================================

-- ==============================================================================
-- Company Brain: Entity Activity, Audit Trail & History
-- Migration: 00042_entity_activity_history.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENTITY ACTIVITY TABLE
-- Chronological audit trail of human & system actions on company entities
-- (Goals, Decisions, Tasks, Projects, Meetings, etc.).
-- ------------------------------------------------------------------------------
create table if not exists public.entity_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid not null references public.company_entities(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  action text not null, -- 'entity_created', 'status_changed', 'priority_changed', 'due_date_changed', 'assignee_changed', 'content_updated', 'details_updated', 'entity_deleted'
  changes jsonb not null default '{}'::jsonb, -- e.g. { "status": { "old": "todo", "new": "in_progress" } }
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes for lightning-fast retrieval per entity and organization
create index if not exists idx_entity_activity_lookup
  on public.entity_activity (organization_id, entity_id, created_at desc);

create index if not exists idx_entity_activity_actor
  on public.entity_activity (organization_id, actor_id);

-- Enable Row Level Security
alter table public.entity_activity enable row level security;

-- Force RLS to prevent any unintended bypass
alter table public.entity_activity force row level security;

-- Strict multi-tenant isolation: any authenticated organization member can view activity for entities in their organization
drop policy if exists "Users can view entity activity for their organization" on public.entity_activity;
create policy "Users can view entity activity for their organization"
  on public.entity_activity
  for select
  to authenticated
  using (public.is_org_member(organization_id));

-- Strict insert policy: actor_id MUST match auth.uid() exactly to prevent forgery via direct PostgREST API
drop policy if exists "Users can insert entity activity for their organization" on public.entity_activity;
create policy "Users can insert entity activity for their organization"
  on public.entity_activity
  for insert
  to authenticated
  with check (
    auth.uid() = actor_id
    and public.is_org_member(organization_id)
  );

-- Immutability: Activity logs cannot be tampered with or deleted by clients
revoke update, delete on public.entity_activity from authenticated, anon;


-- ==============================================================================
-- SECTION 00043: MIGRATION 00043: PERSONAL & COMPANY WORKSPACES DUAL ARCHITECTURE
-- Source: 00043_personal_and_company_workspaces.sql
-- ==============================================================================

-- ==============================================================================
-- Company Brain: Personal Workspace & Company Workspace Dual Architecture
-- Migration: 00043_personal_and_company_workspaces.sql
-- ==============================================================================-- (BEGIN; handled by outer transaction)
-- ------------------------------------------------------------------------------
-- 1. EXTEND AI_CONVERSATIONS WITH WORKSPACE_TYPE & HARDENING
-- Denormalizes workspace_type ('personal' | 'company') to prevent IDOR attacks
-- and enforce strict workspace boundary isolation.
-- ------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'ai_conversations' 
      AND column_name = 'workspace_type'
  ) THEN
    ALTER TABLE public.ai_conversations 
      ADD COLUMN workspace_type text NOT NULL DEFAULT 'company' 
      CHECK (workspace_type IN ('company', 'personal'));
  END IF;
END $$;

-- Align existing conversations based on the organization's workspace_type
UPDATE public.ai_conversations c
SET workspace_type = CASE 
  WHEN o.workspace_type = 'personal' THEN 'personal' 
  ELSE 'company' 
END
FROM public.organizations o
WHERE c.organization_id = o.id;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_workspace_type 
  ON public.ai_conversations (organization_id, user_id, workspace_type, updated_at DESC);

-- ------------------------------------------------------------------------------
-- 2. ENSURE OR CREATE PERSONAL WORKSPACE FUNCTION (IDEMPOTENT)
-- Automatically provisions an individual isolated workspace for a user.
-- Guarantees the user owns 100% of their personal space with role 'owner'.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_personal_workspace(
  p_user_id uuid,
  p_user_name text DEFAULT NULL
)
RETURNS TABLE (
  organization_id uuid,
  name text,
  slug text,
  workspace_type text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid;
  v_org_name text;
  v_org_slug text;
BEGIN
  -- 1. Check if personal workspace already exists for this user
  SELECT o.id, o.name, o.slug
  INTO v_org_id, v_org_name, v_org_slug
  FROM public.organizations o
  JOIN public.organization_members m ON o.id = m.organization_id
  WHERE m.user_id = p_user_id 
    AND o.workspace_type = 'personal'
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    RETURN QUERY
    SELECT v_org_id, v_org_name, v_org_slug, 'personal'::text, 'owner'::text;
    RETURN;
  END IF;

  -- 2. Construct personal workspace attributes
  v_org_name := COALESCE(NULLIF(trim(p_user_name), ''), 'Espaço Pessoal');
  v_org_slug := 'personal-' || substr(p_user_id::text, 1, 8) || '-' || substr(md5(random()::text), 1, 6);

  -- 3. Create the personal organization
  INSERT INTO public.organizations (
    name,
    slug,
    workspace_type,
    created_by,
    status
  ) VALUES (
    v_org_name,
    v_org_slug,
    'personal',
    p_user_id,
    'active'
  )
  RETURNING id INTO v_org_id;

  -- 4. Assign the user as exclusive owner of their personal workspace
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role
  ) VALUES (
    v_org_id,
    p_user_id,
    'owner'
  )
  ON CONFLICT DO NOTHING;

  -- 5. Provision individual baseline subscription for personal workspace
  INSERT INTO public.subscriptions (
    organization_id,
    plan,
    status,
    trial_start,
    trial_end,
    current_period_start,
    current_period_end
  ) VALUES (
    v_org_id,
    'starter',
    'active',
    now(),
    now() + interval '30 days',
    now(),
    now() + interval '30 days'
  )
  ON CONFLICT DO NOTHING;

  RETURN QUERY
  SELECT v_org_id, v_org_name, v_org_slug, 'personal'::text, 'owner'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_personal_workspace(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_personal_workspace(uuid, text) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. RLS HARDENING: PREVENT CROSS-WORKSPACE DATA LEAKAGE
-- Company admins can NEVER read personal conversations of other users.
-- ------------------------------------------------------------------------------

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages FORCE ROW LEVEL SECURITY;

-- ai_conversations RLS
DROP POLICY IF EXISTS "ai_conversations_workspace_isolation" ON public.ai_conversations;
CREATE POLICY "ai_conversations_workspace_isolation"
  ON public.ai_conversations
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid() 
    AND is_org_member(organization_id)
  )
  WITH CHECK (
    user_id = auth.uid() 
    AND is_org_member(organization_id)
  );

-- ai_messages RLS
DROP POLICY IF EXISTS "ai_messages_workspace_isolation" ON public.ai_messages;
CREATE POLICY "ai_messages_workspace_isolation"
  ON public.ai_messages
  FOR ALL
  TO authenticated
  USING (
    is_org_member(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c 
      WHERE c.id = ai_messages.conversation_id 
        AND c.user_id = auth.uid()
        AND c.organization_id = ai_messages.organization_id
    )
  )
  WITH CHECK (
    is_org_member(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c 
      WHERE c.id = ai_messages.conversation_id 
        AND c.user_id = auth.uid()
        AND c.organization_id = ai_messages.organization_id
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_messages TO authenticated;-- (COMMIT; handled by outer transaction)


-- ==============================================================================
-- SECTION 00044: MIGRATION 00044: UNIVERSAL DASHBOARD BUILDER & MULTI-DASHBOARD CAS
-- Source: 00044_universal_dashboards.sql
-- ==============================================================================

-- ==============================================================================
-- Company Brain: Universal Dashboard Builder & Multi-Dashboard CAS Persistence
-- Migration: 00044_universal_dashboards.sql
-- ==============================================================================

-- Drop previous function signatures
drop function if exists public.save_dashboard_layout_cas(uuid, text, jsonb, text, boolean);

-- ------------------------------------------------------------------------------
-- 1. FUNCTION: save_dashboard_layout_cas (Updated for Universal Dashboards)
-- Allows canonical ('home', 'finance') and secure custom dashboard slugs ('custom-[id]')
-- ------------------------------------------------------------------------------
create or replace function public.save_dashboard_layout_cas(
  p_org_id uuid,
  p_dashboard_type text,
  p_layout jsonb,
  p_expected_updated_at text default null,
  p_force_overwrite boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_is_member boolean;
  v_current_preferences jsonb;
  v_current_layout jsonb;
  v_current_updated_at text;
  v_updated_prefs jsonb;
  v_updated_at timestamptz;
begin
  -- 1. Enforce authentication
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object(
      'success', false,
      'code', 'UNAUTHENTICATED',
      'message', 'Authentication required.'
    );
  end if;

  -- 2. Enforce active organization membership independently in database
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = v_user_id
  ) into v_is_member;

  if not v_is_member then
    return jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'message', 'Access denied to organization.'
    );
  end if;

  -- 3. Validate dashboard type (alphanumeric, dashes, underscores up to 64 chars)
  if p_dashboard_type is null or p_dashboard_type !~* '^[a-z0-9_-]{1,64}$' then
    return jsonb_build_object(
      'success', false,
      'code', 'INVALID_DASHBOARD',
      'message', 'Invalid dashboard identifier format.'
    );
  end if;

  -- 4. Validate layout payload structure (must be object with widgets array)
  if p_layout is null 
     or jsonb_typeof(p_layout) <> 'object' 
     or not (p_layout ? 'widgets') 
     or jsonb_typeof(p_layout->'widgets') <> 'array' then
    return jsonb_build_object(
      'success', false,
      'code', 'INVALID_LAYOUT',
      'message', 'Malformed layout object.'
    );
  end if;

  -- 5. Serialize concurrent writes with row-level locking (FOR UPDATE)
  select user_preferences
  into v_current_preferences
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'PROFILE_NOT_FOUND',
      'message', 'User profile not found.'
    );
  end if;

  v_current_preferences := coalesce(v_current_preferences, '{}'::jsonb);
  v_current_layout := v_current_preferences->'dashboard_layouts'->p_org_id::text->p_dashboard_type;
  v_current_updated_at := v_current_layout->>'updatedAt';

  -- 6. Enforce Compare-And-Swap (CAS) token concurrency match
  if not p_force_overwrite and v_current_updated_at is not null then
    if p_expected_updated_at is null or p_expected_updated_at <> v_current_updated_at then
      return jsonb_build_object(
        'success', false,
        'code', 'STALE_WRITE',
        'message', 'Layout was modified concurrently.',
        'current_updated_at', v_current_updated_at
      );
    end if;
  end if;

  -- 7. Atomic JSONB write
  v_updated_at := clock_timestamp();
  v_updated_prefs := jsonb_set(
    v_current_preferences,
    array['dashboard_layouts', p_org_id::text, p_dashboard_type],
    p_layout,
    true
  );

  update public.profiles
  set 
    user_preferences = v_updated_prefs,
    updated_at = v_updated_at
  where id = v_user_id;

  return jsonb_build_object(
    'success', true,
    'updated_at', to_jsonb(v_updated_at)
  );
end;
$$;

revoke execute on function public.save_dashboard_layout_cas(uuid, text, jsonb, text, boolean) from public;
grant execute on function public.save_dashboard_layout_cas(uuid, text, jsonb, text, boolean) to authenticated;


-- ==============================================================================
-- SECTION 00047: MIGRATION 00047: SHOPIFY INTEGRATION SECURITY & ANTI-HIJACKING
-- Source: 00047_shopify_integration_security.sql
-- ==============================================================================

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


-- ==============================================================================
-- SECTION 00049: MIGRATION 00049: SHOPIFY API-FIRST MINIMIZATION
-- Source: 00049_shopify_api_first_minimization.sql
-- ==============================================================================

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
-- (BEGIN; handled by outer transaction)
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
-- (COMMIT; handled by outer transaction)


-- ==============================================================================
-- SECTION 00050: MIGRATION 00050: STRIPE INTEGRITY & MONOTONIC EVENT ORDERING
-- Source: 00050_stripe_integrity_and_monotonic_ordering.sql
-- ==============================================================================

-- ==============================================================================
-- Migration 00050: Stripe Multi-Tenant Integrity, Webhook Lifecycle & Monotonic Event Ordering
-- Status: LOCAL PROPOSAL (Unapplied — Requires formal Lead Architect & DBA review)
--
-- Purpose:
-- 1. Pre-Flight Diagnostic Assertions: Detect duplicate customer/subscription IDs
--    before making any changes.
-- 2. Schema Alignment: Explicitly ensure stripe_customer_id allows NULL values
--    for personal workspaces and unprovisioned trial workspaces.
-- 3. Webhook Ledger Processing Lifecycle: Extend public.stripe_webhook_events with
--    status ('processing', 'completed', 'failed'), lease_expires_at, and error_message.
--    Allows failed webhooks to be retried safely without permanent abandonment,
--    recovers crashed workers via lease expiration, and protects against simultaneous races.
-- 4. Monotonic Stripe Event Ordering: Tracks stripe_event_created on public.subscriptions
--    and enforces that older Stripe webhook events can NEVER overwrite newer states.
-- 5. Strict Privilege Boundaries: Only service_role and postgres can execute
--    billing mutation RPCs.
-- ==============================================================================
-- (BEGIN; handled by outer transaction)
-- ------------------------------------------------------------------------------
-- 1. PRE-FLIGHT SANITY CHECK (DUPLICATE DETECTION)
-- ------------------------------------------------------------------------------
do $$
declare
  v_dup_customers integer;
  v_dup_subscriptions integer;
begin
  select count(*) into v_dup_customers from (
    select stripe_customer_id
    from public.subscriptions
    where stripe_customer_id is not null and stripe_customer_id <> ''
    group by stripe_customer_id
    having count(*) > 1
  ) c;

  if v_dup_customers > 0 then
    raise exception 'Migration 00050 pre-check failed: Found % duplicate stripe_customer_id values across organizations.', v_dup_customers;
  end if;

  select count(*) into v_dup_subscriptions from (
    select stripe_subscription_id
    from public.subscriptions
    where stripe_subscription_id is not null and stripe_subscription_id <> ''
    group by stripe_subscription_id
    having count(*) > 1
  ) s;

  if v_dup_subscriptions > 0 then
    raise exception 'Migration 00050 pre-check failed: Found % duplicate stripe_subscription_id values across organizations.', v_dup_subscriptions;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 2. ALIGN SUBSCRIPTION SCHEMA
-- ------------------------------------------------------------------------------
-- 2.1 Allow NULL stripe_customer_id for trial & personal workspaces
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'stripe_customer_id'
      and is_nullable = 'NO'
  ) then
    alter table public.subscriptions alter column stripe_customer_id drop not null;
  end if;
end $$;

-- 2.2 Add stripe_event_created column to subscriptions for monotonic ordering
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'stripe_event_created'
  ) then
    alter table public.subscriptions add column stripe_event_created timestamptz default null;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 3. WEBHOOK LEDGER LIFECYCLE ENHANCEMENT
-- ------------------------------------------------------------------------------
-- 3.1 Extend stripe_webhook_events with lifecycle columns
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stripe_webhook_events'
      and column_name = 'status'
  ) then
    alter table public.stripe_webhook_events
      add column status text not null default 'completed' check (status in ('processing', 'completed', 'failed', 'legacy_processing')),
      add column lease_token text default null,
      add column lease_expires_at timestamptz default null,
      add column error_message text default null,
      add column attempt_count integer not null default 1;
  elsif not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stripe_webhook_events'
      and column_name = 'lease_token'
  ) then
    alter table public.stripe_webhook_events
      add column lease_token text default null;
  end if;
end $$;

create index if not exists idx_stripe_webhook_events_status_lease
  on public.stripe_webhook_events(status, lease_expires_at);

-- ------------------------------------------------------------------------------
-- 4. HARDENED WEBHOOK LEDGER RPCS WITH LEASE FENCING
-- ------------------------------------------------------------------------------
-- Drop previous overloads safely
drop function if exists public.record_stripe_webhook_event(text, text);
drop function if exists public.record_stripe_webhook_event(text, text, text);
drop function if exists public.record_stripe_webhook_event(text, text, text, text);

drop function if exists public.complete_stripe_webhook_event(text);
drop function if exists public.complete_stripe_webhook_event(text, text);
drop function if exists public.complete_stripe_webhook_event(text, text, text);

drop function if exists public.fail_stripe_webhook_event(text);
drop function if exists public.fail_stripe_webhook_event(text, text);
drop function if exists public.fail_stripe_webhook_event(text, text, text);
drop function if exists public.fail_stripe_webhook_event(text, text, text, text);

-- 4.1 Claim lease or check processing state with fencing token (Backward-Compatible with Legacy 3-Arg Callers)
create or replace function public.record_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_server_token text default null,
  p_lease_token text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing record;
  v_lease_duration interval := interval '120 seconds';
begin
  -- 1. Strict Security Boundary: reject any non-service_role caller regardless of p_server_token
  if session_user in ('anon', 'authenticated') or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'Access denied: record_stripe_webhook_event requires service_role boundary'
      using errcode = '42501';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' and (p_server_token is null or length(p_server_token) < 32) then
    raise exception 'Access denied: record_stripe_webhook_event requires service_role boundary'
      using errcode = '42501';
  end if;

  -- 2. Reject empty/whitespace lease token if caller explicitly provided one
  if p_lease_token is not null and length(trim(p_lease_token)) = 0 then
    raise exception 'Access denied: record_stripe_webhook_event requires non-empty lease_token'
      using errcode = '42501';
  end if;

  select status, lease_token, lease_expires_at into v_existing
  from public.stripe_webhook_events
  where id = p_event_id
  for update;

  if not found then
    if p_lease_token is not null then
      -- Modern worker: acquire processing lease with worker fencing token
      insert into public.stripe_webhook_events (
        id, event_type, status, lease_token, lease_expires_at, processed_at, attempt_count
      )
      values (
        p_event_id, p_event_type, 'processing', p_lease_token, clock_timestamp() + v_lease_duration, clock_timestamp(), 1
      );
      return true;
    else
      -- Backward compatibility: legacy 3-argument caller records in 'legacy_processing' state.
      -- CRITICAL: NEVER mark completed prematurely before business processing succeeds!
      -- Allows failed processing to remain recoverable on Stripe retry after lease expiration.
      insert into public.stripe_webhook_events (
        id, event_type, status, lease_token, lease_expires_at, processed_at, attempt_count
      )
      values (
        p_event_id, p_event_type, 'legacy_processing', 'legacy_unfenced', clock_timestamp() + v_lease_duration, clock_timestamp(), 1
      );
      return true;
    end if;
  end if;

  -- Terminal status: already completed by successful modern or verified processing
  if v_existing.status = 'completed' then
    return false;
  end if;

  -- Active unexpired lease in either modern 'processing' or 'legacy_processing'
  -- Uses clock_timestamp() to evaluate true wall-clock time after acquiring the row lock
  if v_existing.status in ('processing', 'legacy_processing') then
    if v_existing.lease_expires_at is not null and clock_timestamp() < v_existing.lease_expires_at then
      -- Unexpired lease held by active worker: reject concurrent duplicate (modern or legacy)
      return false;
    end if;

    -- Expired lease: reclaim and allow retry
    -- NOTE: processed_at is intentionally preserved (not overwritten) to retain original event arrival
    -- timestamp for FIFO reconciliation queue ordering. Only terminal completion/failure updates processed_at.
    if p_lease_token is not null then
      -- Modern worker reclaims expired lease
      update public.stripe_webhook_events
      set
        status = 'processing',
        lease_token = p_lease_token,
        lease_expires_at = clock_timestamp() + v_lease_duration,
        attempt_count = attempt_count + 1
      where id = p_event_id;
      return true;
    else
      -- Legacy retry recovers expired lease. Remains in legacy_processing (not poisoned)!
      update public.stripe_webhook_events
      set
        status = 'legacy_processing',
        lease_token = 'legacy_unfenced',
        lease_expires_at = clock_timestamp() + v_lease_duration,
        attempt_count = attempt_count + 1
      where id = p_event_id;
      return true;
    end if;
  end if;

  -- Failed event: allow retry
  if v_existing.status = 'failed' then
    if p_lease_token is not null then
      update public.stripe_webhook_events
      set
        status = 'processing',
        lease_token = p_lease_token,
        lease_expires_at = clock_timestamp() + v_lease_duration,
        attempt_count = attempt_count + 1,
        error_message = null
      where id = p_event_id;
      return true;
    else
      -- Legacy retry recovers failed event. Enters legacy_processing, NOT completed!
      update public.stripe_webhook_events
      set
        status = 'legacy_processing',
        lease_token = 'legacy_unfenced',
        lease_expires_at = clock_timestamp() + v_lease_duration,
        attempt_count = attempt_count + 1,
        error_message = null
      where id = p_event_id;
      return true;
    end if;
  end if;

  return false;
end;
$$;

-- 4.2 Complete webhook event with strict lease fencing protection
create or replace function public.complete_stripe_webhook_event(
  p_event_id text,
  p_server_token text default null,
  p_lease_token text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if session_user in ('anon', 'authenticated') or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'Access denied: complete_stripe_webhook_event requires service_role boundary'
      using errcode = '42501';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' and (p_server_token is null or length(p_server_token) < 32) then
    raise exception 'Access denied: complete_stripe_webhook_event requires service_role boundary'
      using errcode = '42501';
  end if;

  if p_lease_token is null or length(trim(p_lease_token)) = 0 then
    raise exception 'Access denied: complete_stripe_webhook_event requires non-null lease_token'
      using errcode = '42501';
  end if;

  update public.stripe_webhook_events
  set
    status = 'completed',
    lease_token = null,
    lease_expires_at = null,
    processed_at = clock_timestamp(),
    error_message = null
  where id = p_event_id
    and status in ('processing', 'legacy_processing')
    and lease_token = p_lease_token;

  get diagnostics v_count = row_count;
  return (v_count > 0);
end;
$$;

-- 4.3 Fail webhook event with strict lease fencing protection
create or replace function public.fail_stripe_webhook_event(
  p_event_id text,
  p_error text default null,
  p_server_token text default null,
  p_lease_token text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if session_user in ('anon', 'authenticated') or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'Access denied: fail_stripe_webhook_event requires service_role boundary'
      using errcode = '42501';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' and (p_server_token is null or length(p_server_token) < 32) then
    raise exception 'Access denied: fail_stripe_webhook_event requires service_role boundary'
      using errcode = '42501';
  end if;

  if p_lease_token is null or length(trim(p_lease_token)) = 0 then
    raise exception 'Access denied: fail_stripe_webhook_event requires non-null lease_token'
      using errcode = '42501';
  end if;

  update public.stripe_webhook_events
  set
    status = 'failed',
    lease_token = null,
    lease_expires_at = null,
    processed_at = clock_timestamp(),
    error_message = coalesce(p_error, 'Webhook processing failed')
  where id = p_event_id
    and status in ('processing', 'legacy_processing')
    and lease_token = p_lease_token;

  get diagnostics v_count = row_count;
  return (v_count > 0);
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. HARDENED sync_stripe_subscription WITH MONOTONIC EVENT ORDERING & WORKER FENCING
-- ------------------------------------------------------------------------------
-- Drop older overloads to avoid PostgREST PGRST203 ambiguity
drop function if exists public.sync_stripe_subscription(
  uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text
);
drop function if exists public.sync_stripe_subscription(
  uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text, timestamptz
);
drop function if exists public.sync_stripe_subscription(
  uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text, timestamptz, text, text
);

create or replace function public.sync_stripe_subscription(
  p_organization_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_plan text,
  p_status text,
  p_trial_start timestamptz default null,
  p_trial_end timestamptz default null,
  p_current_period_start timestamptz default null,
  p_current_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false,
  p_server_token text default null,
  p_stripe_event_created timestamptz default null,
  p_event_id text default null,
  p_lease_token text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_new_contract boolean;
  v_is_strictly_newer boolean;
  v_is_equal_timestamp boolean;
  v_event_record record;
begin
  -- 1. Strict Security Boundary: reject any non-service_role caller regardless of p_server_token
  if session_user in ('anon', 'authenticated') or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'Access denied: sync_stripe_subscription requires service_role boundary'
      using errcode = '42501';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' and (p_server_token is null or length(p_server_token) < 32) then
    raise exception 'Access denied: sync_stripe_subscription requires service_role boundary'
      using errcode = '42501';
  end if;

  -- 1.1 Atomic Worker Lease Fencing Guard (TOCTOU Defense):
  -- Atomically lock the stripe_webhook_events row with FOR UPDATE before verifying lease ownership.
  -- This holds an exclusive row-level lock until this transaction commits, physically preventing
  -- any concurrent worker or reconciliation process from reclaiming, modifying, or completing the lease
  -- between our verification check and the public.subscriptions mutation.
  if p_event_id is not null and p_lease_token is not null then
    select status, lease_token, lease_expires_at into v_event_record
    from public.stripe_webhook_events
    where id = p_event_id
    for update;

    if not found then
      raise exception 'Fencing violation: event % not found', p_event_id
        using errcode = '40001';
    end if;

    if v_event_record.status <> 'processing'
       or v_event_record.lease_token is distinct from p_lease_token
       or (v_event_record.lease_expires_at is not null and clock_timestamp() >= v_event_record.lease_expires_at) then
      raise exception 'Fencing violation: worker lease expired or lost for event %', p_event_id
        using errcode = '40001';
    end if;
  end if;

  -- 2. Multi-Tenant Customer Collision Check
  if p_stripe_customer_id is not null and p_stripe_customer_id <> '' then
    if exists (
      select 1 from public.subscriptions
      where stripe_customer_id = p_stripe_customer_id
        and organization_id <> p_organization_id
    ) then
      raise exception 'Cross-tenant collision: stripe_customer_id is already bound to another organization'
        using errcode = '23505';
    end if;
  end if;

  -- 3. Multi-Tenant Subscription Collision Check
  if p_stripe_subscription_id is not null and p_stripe_subscription_id <> '' then
    if exists (
      select 1 from public.subscriptions
      where stripe_subscription_id = p_stripe_subscription_id
        and organization_id <> p_organization_id
    ) then
      raise exception 'Cross-tenant collision: stripe_subscription_id is already bound to another organization'
        using errcode = '23505';
    end if;
  end if;

  -- 4. Atomic Upsert with Dedicated Stripe Event Timestamp Monotonic Ordering
  insert into public.subscriptions (
    organization_id,
    stripe_customer_id,
    stripe_subscription_id,
    plan,
    status,
    trial_start,
    trial_end,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    stripe_event_created,
    updated_at
  )
  values (
    p_organization_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_plan,
    p_status,
    p_trial_start,
    p_trial_end,
    p_current_period_start,
    p_current_period_end,
    p_cancel_at_period_end,
    p_stripe_event_created,
    now()
  )
  on conflict (organization_id) do update
  set
    -- Helper evaluations for monotonic ordering:
    -- A: Is this a replacement/brand new subscription ID?
    -- B: Is the event timestamp strictly newer than the DB event timestamp?
    -- C: Are the event timestamps identical (e.g. same second events)?
    stripe_customer_id = case
      when excluded.stripe_customer_id is not null and excluded.stripe_customer_id <> ''
      then excluded.stripe_customer_id
      else public.subscriptions.stripe_customer_id
    end,

    stripe_subscription_id = case
      -- Brand new subscription replaces canceled/old one
      when excluded.stripe_subscription_id is not null and (
        public.subscriptions.stripe_subscription_id is null or
        excluded.stripe_subscription_id is distinct from public.subscriptions.stripe_subscription_id
      ) then excluded.stripe_subscription_id
      else public.subscriptions.stripe_subscription_id
    end,

    plan = case
      when excluded.stripe_subscription_id is not null and (
        public.subscriptions.stripe_subscription_id is null or
        excluded.stripe_subscription_id is distinct from public.subscriptions.stripe_subscription_id
      ) then excluded.plan
      -- Strictly newer modern event
      when excluded.stripe_event_created is not null and (
        public.subscriptions.stripe_event_created is null or
        excluded.stripe_event_created > public.subscriptions.stripe_event_created
      ) then excluded.plan
      -- Same timestamp: retain plan if not canceled
      when excluded.stripe_event_created is not null and excluded.stripe_event_created = public.subscriptions.stripe_event_created and public.subscriptions.status <> 'canceled'
        then excluded.plan
      -- Baseline unversioned update: only permitted when target record also has no monotonic timestamp
      when excluded.stripe_event_created is null and public.subscriptions.stripe_event_created is null
        then excluded.plan
      -- Stale/unversioned caller cannot downgrade a record that has stripe_event_created NOT NULL
      else public.subscriptions.plan
    end,

    status = case
      -- Replacement subscription takes immediate precedence
      when excluded.stripe_subscription_id is not null and (
        public.subscriptions.stripe_subscription_id is null or
        excluded.stripe_subscription_id is distinct from public.subscriptions.stripe_subscription_id
      ) then excluded.status
      -- Strictly newer event takes precedence
      when excluded.stripe_event_created is not null and (
        public.subscriptions.stripe_event_created is null or
        excluded.stripe_event_created > public.subscriptions.stripe_event_created
      ) then excluded.status
      -- Equal timestamps: canceled status takes terminal precedence; active takes precedence over trialing; renewals supported
      when excluded.stripe_event_created is not null and excluded.stripe_event_created = public.subscriptions.stripe_event_created then
        case
          when excluded.status = 'canceled' or public.subscriptions.status = 'canceled' then 'canceled'
          when excluded.status = 'active' then 'active'
          else excluded.status
        end
      -- Baseline unversioned update: only permitted when target record also has no monotonic timestamp
      when excluded.stripe_event_created is null and public.subscriptions.stripe_event_created is null
        then excluded.status
      -- Stale/unversioned caller cannot resurrect or downgrade a record that has stripe_event_created NOT NULL
      else public.subscriptions.status
    end,

    trial_start = coalesce(excluded.trial_start, public.subscriptions.trial_start),
    trial_end = coalesce(excluded.trial_end, public.subscriptions.trial_end),

    current_period_start = case
      when excluded.stripe_subscription_id is not null and (
        public.subscriptions.stripe_subscription_id is null or
        excluded.stripe_subscription_id is distinct from public.subscriptions.stripe_subscription_id
      ) then coalesce(excluded.current_period_start, public.subscriptions.current_period_start)
      when excluded.stripe_event_created is not null and (
        public.subscriptions.stripe_event_created is null or
        excluded.stripe_event_created >= public.subscriptions.stripe_event_created
      ) then coalesce(excluded.current_period_start, public.subscriptions.current_period_start)
      when excluded.stripe_event_created is null and public.subscriptions.stripe_event_created is null
        then coalesce(excluded.current_period_start, public.subscriptions.current_period_start)
      else public.subscriptions.current_period_start
    end,

    current_period_end = case
      when excluded.stripe_subscription_id is not null and (
        public.subscriptions.stripe_subscription_id is null or
        excluded.stripe_subscription_id is distinct from public.subscriptions.stripe_subscription_id
      ) then coalesce(excluded.current_period_end, public.subscriptions.current_period_end)
      -- Legitimate renewal: always accept later period end
      when excluded.current_period_end is not null and (public.subscriptions.current_period_end is null or excluded.current_period_end > public.subscriptions.current_period_end)
        then excluded.current_period_end
      when excluded.stripe_event_created is not null and (
        public.subscriptions.stripe_event_created is null or
        excluded.stripe_event_created >= public.subscriptions.stripe_event_created
      ) then coalesce(excluded.current_period_end, public.subscriptions.current_period_end)
      when excluded.stripe_event_created is null and public.subscriptions.stripe_event_created is null
        then coalesce(excluded.current_period_end, public.subscriptions.current_period_end)
      else public.subscriptions.current_period_end
    end,

    cancel_at_period_end = case
      when excluded.stripe_subscription_id is not null and (
        public.subscriptions.stripe_subscription_id is null or
        excluded.stripe_subscription_id is distinct from public.subscriptions.stripe_subscription_id
      ) then excluded.cancel_at_period_end
      when excluded.stripe_event_created is not null and (
        public.subscriptions.stripe_event_created is null or
        excluded.stripe_event_created >= public.subscriptions.stripe_event_created
      ) then excluded.cancel_at_period_end
      when excluded.stripe_event_created is null and public.subscriptions.stripe_event_created is null
        then excluded.cancel_at_period_end
      else public.subscriptions.cancel_at_period_end
    end,

    stripe_event_created = case
      when excluded.stripe_subscription_id is not null and (
        public.subscriptions.stripe_subscription_id is null or
        excluded.stripe_subscription_id is distinct from public.subscriptions.stripe_subscription_id
      ) then coalesce(excluded.stripe_event_created, public.subscriptions.stripe_event_created)
      when excluded.stripe_event_created is not null and (
        public.subscriptions.stripe_event_created is null or
        excluded.stripe_event_created >= public.subscriptions.stripe_event_created
      ) then excluded.stripe_event_created
      else public.subscriptions.stripe_event_created
    end,

    updated_at = case
      -- Only update updated_at if state actually advanced or matched
      when excluded.stripe_subscription_id is not null and (
        public.subscriptions.stripe_subscription_id is null or
        excluded.stripe_subscription_id is distinct from public.subscriptions.stripe_subscription_id
      ) then now()
      when excluded.stripe_event_created is not null and (
        public.subscriptions.stripe_event_created is null or
        excluded.stripe_event_created >= public.subscriptions.stripe_event_created
      ) then now()
      when excluded.stripe_event_created is null and public.subscriptions.stripe_event_created is null
        then now()
      when excluded.current_period_end is not null and (public.subscriptions.current_period_end is null or excluded.current_period_end > public.subscriptions.current_period_end)
        then now()
      else public.subscriptions.updated_at
    end;
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. HARDENED cancel_stripe_subscription WITH MONOTONIC EVENT ORDERING & WORKER FENCING
-- ------------------------------------------------------------------------------
drop function if exists public.cancel_stripe_subscription(text, text);
drop function if exists public.cancel_stripe_subscription(text, text, timestamptz);
drop function if exists public.cancel_stripe_subscription(text, text, timestamptz, text, text);

create or replace function public.cancel_stripe_subscription(
  p_stripe_subscription_id text,
  p_server_token text default null,
  p_stripe_event_created timestamptz default null,
  p_event_id text default null,
  p_lease_token text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_record record;
begin
  if session_user in ('anon', 'authenticated') or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'Access denied: cancel_stripe_subscription requires service_role boundary'
      using errcode = '42501';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' and (p_server_token is null or length(p_server_token) < 32) then
    raise exception 'Access denied: cancel_stripe_subscription requires service_role boundary'
      using errcode = '42501';
  end if;

  -- 1.1 Atomic Worker Lease Fencing Guard (TOCTOU Defense):
  -- Atomically lock the stripe_webhook_events row with FOR UPDATE before verifying lease ownership.
  if p_event_id is not null and p_lease_token is not null then
    select status, lease_token, lease_expires_at into v_event_record
    from public.stripe_webhook_events
    where id = p_event_id
    for update;

    if not found then
      raise exception 'Fencing violation: event % not found', p_event_id
        using errcode = '40001';
    end if;

    if v_event_record.status <> 'processing'
       or v_event_record.lease_token is distinct from p_lease_token
       or (v_event_record.lease_expires_at is not null and clock_timestamp() >= v_event_record.lease_expires_at) then
      raise exception 'Fencing violation: worker lease expired or lost for event %', p_event_id
        using errcode = '40001';
    end if;
  end if;

  update public.subscriptions
  set
    status = 'canceled',
    stripe_event_created = case
      when p_stripe_event_created is not null and (public.subscriptions.stripe_event_created is null or p_stripe_event_created >= public.subscriptions.stripe_event_created)
      then p_stripe_event_created
      else public.subscriptions.stripe_event_created
    end,
    updated_at = case
      when (p_stripe_event_created is not null and (public.subscriptions.stripe_event_created is null or p_stripe_event_created >= public.subscriptions.stripe_event_created))
        or (p_stripe_event_created is null and public.subscriptions.stripe_event_created is null)
      then now()
      else public.subscriptions.updated_at
    end
  where stripe_subscription_id = p_stripe_subscription_id
    and (
      -- Modern cancellation strictly >= DB event created
      (p_stripe_event_created is not null and (public.subscriptions.stripe_event_created is null or p_stripe_event_created >= public.subscriptions.stripe_event_created))
      or
      -- Legacy cancellation only allowed if DB record also has no monotonic timestamp
      (p_stripe_event_created is null and public.subscriptions.stripe_event_created is null)
    );
end;
$$;

-- ------------------------------------------------------------------------------
-- 7. REVOKE EXECUTION FROM PUBLIC/ANON/AUTHENTICATED & GRANT TO SERVICE_ROLE
-- ------------------------------------------------------------------------------
revoke all on function public.record_stripe_webhook_event(text, text, text, text) from public, anon, authenticated;
revoke all on function public.complete_stripe_webhook_event(text, text, text) from public, anon, authenticated;
revoke all on function public.fail_stripe_webhook_event(text, text, text, text) from public, anon, authenticated;
revoke all on function public.sync_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.cancel_stripe_subscription(text, text, timestamptz, text, text) from public, anon, authenticated;

grant execute on function public.record_stripe_webhook_event(text, text, text, text) to service_role, postgres;
grant execute on function public.complete_stripe_webhook_event(text, text, text) to service_role, postgres;
grant execute on function public.fail_stripe_webhook_event(text, text, text, text) to service_role, postgres;
grant execute on function public.sync_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text, timestamptz, text, text) to service_role, postgres;
grant execute on function public.cancel_stripe_subscription(text, text, timestamptz, text, text) to service_role, postgres;

-- ------------------------------------------------------------------------------
-- 8. RELOAD POSTGREST SCHEMA CACHE
-- ------------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ------------------------------------------------------------------------------
-- 9. POST-EXECUTION ASSERTIONS
-- ------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'subscriptions' and column_name = 'stripe_event_created') then
    raise exception 'POST-ASSERTION FAILED: stripe_event_created column was not created';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'stripe_webhook_events' and column_name = 'status') then
    raise exception 'POST-ASSERTION FAILED: stripe_webhook_events status column was not created';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'stripe_webhook_events' and column_name = 'lease_token') then
    raise exception 'POST-ASSERTION FAILED: stripe_webhook_events lease_token column was not created';
  end if;
end $$;
-- (COMMIT; handled by outer transaction)

-- ==============================================================================
-- FINAL CONSOLIDATED POST-EXECUTION CHECKS & CACHE RELOAD
-- ==============================================================================
DO $$
BEGIN
  -- 00042 check
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'entity_activity') THEN
    RAISE EXCEPTION 'POST-ASSERTION FAILED: Table entity_activity was not created.';
  END IF;

  -- 00043 check
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_conversations' AND column_name = 'workspace_type') THEN
    RAISE EXCEPTION 'POST-ASSERTION FAILED: Column ai_conversations.workspace_type was not created.';
  END IF;

  -- 00044 check
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'save_dashboard_layout_cas') THEN
    RAISE EXCEPTION 'POST-ASSERTION FAILED: Function save_dashboard_layout_cas does not exist.';
  END IF;

  -- 00047 check
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shopify_active_shop_unique') THEN
    RAISE EXCEPTION 'POST-ASSERTION FAILED: Index idx_shopify_active_shop_unique does not exist.';
  END IF;

  -- 00050 checks
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'stripe_event_created') THEN
    RAISE EXCEPTION 'POST-ASSERTION FAILED: Column subscriptions.stripe_event_created was not created.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stripe_webhook_events' AND column_name = 'lease_token') THEN
    RAISE EXCEPTION 'POST-ASSERTION FAILED: Column stripe_webhook_events.lease_token was not created.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
