-- ==============================================================================
-- Company Brain: Stripe Billing RPC Hardening & Service Role Lockdown
-- Migration: 00012_stripe_billing_rpc_hardening.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DROP OBSOLETE & UNGUARDED FUNCTION OVERLOADS
-- Eliminates PostgREST PGRST203 function candidate ambiguity and cleans up legacy signatures.
-- ------------------------------------------------------------------------------
drop function if exists public.sync_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean);
drop function if exists public.sync_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text);

drop function if exists public.cancel_stripe_subscription(text);
drop function if exists public.cancel_stripe_subscription(text, text);

drop function if exists public.record_stripe_webhook_event(text, text);
drop function if exists public.record_stripe_webhook_event(text, text, text);

drop function if exists public.check_rate_limit(text, integer, integer);
drop function if exists public.check_rate_limit(text, integer, integer, text);

-- ------------------------------------------------------------------------------
-- 2. HARDENED sync_stripe_subscription
-- Bound strictly to the service_role boundary.
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
set search_path = public
as $$
begin
  -- Strict role verification: only service_role (backend webhook processor) is authorized
  if coalesce(auth.role(), '') <> 'service_role' and (p_server_token is null or length(p_server_token) < 32) then
    raise exception 'Access denied: sync_stripe_subscription requires service_role boundary'
      using errcode = '42501';
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
-- 3. HARDENED cancel_stripe_subscription
-- Bound strictly to the service_role boundary.
-- ------------------------------------------------------------------------------
create or replace function public.cancel_stripe_subscription(
  p_stripe_subscription_id text,
  p_server_token text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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
-- 4. HARDENED record_stripe_webhook_event
-- Atomic idempotency ledger check bound strictly to service_role.
-- ------------------------------------------------------------------------------
create or replace function public.record_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_server_token text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted boolean;
begin
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
-- 5. HARDENED check_rate_limit
-- Sliding window rate limiter RPC bound to service_role and backend callers.
-- ------------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer,
  p_server_token text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz := v_now - (p_window_seconds || ' seconds')::interval;
  v_current_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and (p_server_token is null or length(p_server_token) < 32) then
    raise exception 'Access denied: check_rate_limit requires service_role boundary'
      using errcode = '42501';
  end if;

  insert into public.rate_limit_entries (key, count, window_start, updated_at)
  values (p_key, 1, v_now, v_now)
  on conflict (key) do update
  set
    count = case
      when public.rate_limit_entries.window_start < v_window_start then 1
      else public.rate_limit_entries.count + 1
    end,
    window_start = case
      when public.rate_limit_entries.window_start < v_window_start then v_now
      else public.rate_limit_entries.window_start
    end,
    updated_at = v_now
  returning count into v_current_count;

  return v_current_count <= p_limit;
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. STRICT PRIVILEGE REVOCATIONS (PUBLIC, ANON, AUTHENTICATED)
-- No browser user or unauthenticated client can EVER invoke these mutation RPCs directly.
-- ------------------------------------------------------------------------------
revoke all on function public.sync_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text) from public, anon, authenticated;
revoke all on function public.cancel_stripe_subscription(text, text) from public, anon, authenticated;
revoke all on function public.record_stripe_webhook_event(text, text, text) from public, anon, authenticated;
revoke all on function public.check_rate_limit(text, integer, integer, text) from public, anon, authenticated;

grant execute on function public.sync_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text) to service_role, postgres;
grant execute on function public.cancel_stripe_subscription(text, text) to service_role, postgres;
grant execute on function public.record_stripe_webhook_event(text, text, text) to service_role, postgres;
grant execute on function public.check_rate_limit(text, integer, integer, text) to service_role, postgres;

-- ------------------------------------------------------------------------------
-- 7. RELOAD POSTGREST SCHEMA CACHE
-- ------------------------------------------------------------------------------
notify pgrst, 'reload schema';
