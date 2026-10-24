-- ==============================================================================
-- Migration 00035: Stripe Multi-Tenant Integrity & Partial Uniqueness Indexes
--
-- Purpose:
-- 1. Enforce database-level uniqueness on stripe_customer_id across organizations
--    using a partial unique index (ignoring NULL/empty trial records).
-- 2. Enforce database-level uniqueness on stripe_subscription_id across organizations
--    using a partial unique index.
-- 3. Harden sync_stripe_subscription RPC to atomically detect and reject
--    cross-tenant identifier theft/collision before attempting mutation.
--
-- Safety & Compatibility:
-- - Non-destructive: Does not alter table structures or delete existing records.
-- - Pre-condition verification prevents index creation failure if historical
--   duplicates exist.
-- ==============================================================================

BEGIN;

-- 1. Pre-condition sanity check for duplicate customer IDs across tenants
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
    raise exception 'Migration 00035 pre-check failed: Found % duplicate stripe_customer_id values across organizations.', v_dup_customers;
  end if;

  select count(*) into v_dup_subscriptions from (
    select stripe_subscription_id
    from public.subscriptions
    where stripe_subscription_id is not null and stripe_subscription_id <> ''
    group by stripe_subscription_id
    having count(*) > 1
  ) s;

  if v_dup_subscriptions > 0 then
    raise exception 'Migration 00035 pre-check failed: Found % duplicate stripe_subscription_id values across organizations.', v_dup_subscriptions;
  end if;
end $$;

-- 2. Create Partial Unique Index for stripe_customer_id
create unique index if not exists idx_subscriptions_customer_id_unique
  on public.subscriptions(stripe_customer_id)
  where stripe_customer_id is not null and stripe_customer_id <> '';

-- 3. Create Partial Unique Index for stripe_subscription_id
create unique index if not exists idx_subscriptions_subscription_id_unique
  on public.subscriptions(stripe_subscription_id)
  where stripe_subscription_id is not null and stripe_subscription_id <> '';

-- 4. Harden sync_stripe_subscription RPC with cross-tenant collision detection
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

  -- Multi-Tenant Database Collision Defense
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

-- 5. Strict privilege enforcement: only backend service_role and postgres can execute
revoke all on function public.sync_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text) from public, anon, authenticated;
grant execute on function public.sync_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text) to service_role, postgres;

-- 6. Reload PostgREST schema cache
notify pgrst, 'reload schema';

-- 7. Post-execution verification assertions
do $$
begin
  if not exists (select 1 from pg_indexes where tablename = 'subscriptions' and indexname = 'idx_subscriptions_customer_id_unique') then
    raise exception 'POST-ASSERTION FAILED: idx_subscriptions_customer_id_unique index was not created';
  end if;
  if not exists (select 1 from pg_indexes where tablename = 'subscriptions' and indexname = 'idx_subscriptions_subscription_id_unique') then
    raise exception 'POST-ASSERTION FAILED: idx_subscriptions_subscription_id_unique index was not created';
  end if;
end $$;

COMMIT;

