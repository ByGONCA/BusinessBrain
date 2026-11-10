-- ==============================================================================
-- Rollback Migration for 00050: Stripe Multi-Tenant Integrity & Monotonic Ordering
-- Status: LOCAL ROLLBACK PROCEDURE (Do NOT run unless formal rollback is authorized)
--
-- Purpose:
-- Restores database RPC functions to their exact state prior to migration 00050.
-- Specifically restores the baseline functions:
-- 1. sync_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text)
--    -> Baseline: Migration 00035 (includes multi-tenant cross-org collision checks).
-- 2. cancel_stripe_subscription(text, text)
--    -> Baseline: Migration 00012.
-- 3. record_stripe_webhook_event(text, text, text)
--    -> Baseline: Migration 00012.
--
-- Critical Operational Requirements:
-- - TRAFFIC COORDINATION: The application code MUST be rolled back or incoming webhooks paused
--   BEFORE executing this rollback SQL. If this SQL is applied while newer application code is live,
--   calls to complete_stripe_webhook_event or record_stripe_webhook_event with 4 arguments will fail!
-- - Safety & Compatibility:
--   Columns stripe_event_created on subscriptions and status, lease_token,
--   lease_expires_at, attempt_count on stripe_webhook_events are NOT dropped
--   in this transaction. Keeping them as additive nullable/default columns avoids
--   table locks and prevents physical loss of audit records.
-- - PostgREST schema cache is reloaded via notify pgrst, 'reload schema'.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. DROP MIGRATION 00050 RPCS
-- ------------------------------------------------------------------------------
drop function if exists public.record_stripe_webhook_event(text, text, text, text);
drop function if exists public.complete_stripe_webhook_event(text, text, text);
drop function if exists public.fail_stripe_webhook_event(text, text, text, text);
drop function if exists public.sync_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text, timestamptz);
drop function if exists public.sync_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text, timestamptz, text, text);
drop function if exists public.cancel_stripe_subscription(text, text, timestamptz);
drop function if exists public.cancel_stripe_subscription(text, text, timestamptz, text, text);

-- ------------------------------------------------------------------------------
-- 2. RESTORE BASELINE (00035) sync_stripe_subscription
-- ------------------------------------------------------------------------------
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
  p_server_token text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if session_user in ('anon', 'authenticated') or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'Access denied: sync_stripe_subscription requires service_role boundary'
      using errcode = '42501';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' and (p_server_token is null or length(p_server_token) < 32) then
    raise exception 'Access denied: sync_stripe_subscription requires service_role boundary'
      using errcode = '42501';
  end if;

  -- Multi-Tenant Database Collision Defense (Preserved from Migration 00035)
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
    now()
  )
  on conflict (organization_id) do update
  set
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.subscriptions.stripe_subscription_id),
    plan = excluded.plan,
    status = excluded.status,
    trial_start = coalesce(excluded.trial_start, public.subscriptions.trial_start),
    trial_end = coalesce(excluded.trial_end, public.subscriptions.trial_end),
    current_period_start = coalesce(excluded.current_period_start, public.subscriptions.current_period_start),
    current_period_end = coalesce(excluded.current_period_end, public.subscriptions.current_period_end),
    cancel_at_period_end = excluded.cancel_at_period_end,
    updated_at = now();
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. RESTORE BASELINE (00012) cancel_stripe_subscription
-- ------------------------------------------------------------------------------
create or replace function public.cancel_stripe_subscription(
  p_stripe_subscription_id text,
  p_server_token text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if session_user in ('anon', 'authenticated') or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'Access denied: cancel_stripe_subscription requires service_role boundary'
      using errcode = '42501';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' and (p_server_token is null or length(p_server_token) < 32) then
    raise exception 'Access denied: cancel_stripe_subscription requires service_role boundary'
      using errcode = '42501';
  end if;

  update public.subscriptions
  set
    status = 'canceled',
    updated_at = now()
  where stripe_subscription_id = p_stripe_subscription_id;
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. RESTORE BASELINE (00012) record_stripe_webhook_event
-- ------------------------------------------------------------------------------
create or replace function public.record_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_server_token text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer;
begin
  if session_user in ('anon', 'authenticated') or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'Access denied: record_stripe_webhook_event requires service_role boundary'
      using errcode = '42501';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' and (p_server_token is null or length(p_server_token) < 32) then
    raise exception 'Access denied: record_stripe_webhook_event requires service_role boundary'
      using errcode = '42501';
  end if;

  insert into public.stripe_webhook_events (id, event_type, processed_at)
  values (p_event_id, p_event_type, now())
  on conflict (id) do nothing;

  get diagnostics v_inserted = row_count;
  return (v_inserted > 0);
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. REVOKE & GRANT PERMISSIONS
-- ------------------------------------------------------------------------------
revoke all on function public.sync_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text) from public, anon, authenticated;
revoke all on function public.cancel_stripe_subscription(text, text) from public, anon, authenticated;
revoke all on function public.record_stripe_webhook_event(text, text, text) from public, anon, authenticated;

grant execute on function public.sync_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text) to service_role, postgres;
grant execute on function public.cancel_stripe_subscription(text, text) to service_role, postgres;
grant execute on function public.record_stripe_webhook_event(text, text, text) to service_role, postgres;

-- ------------------------------------------------------------------------------
-- 6. RELOAD SCHEMA CACHE
-- ------------------------------------------------------------------------------
notify pgrst, 'reload schema';

COMMIT;
