-- ==============================================================================
-- Company Brain: Phase 0.5 — Subscriptions & Marketing Consent
-- Migration: 00003_subscriptions_and_consent.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD MARKETING CONSENT TO PROFILES
-- ------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz;

-- Update the handle_new_user trigger function to capture marketing consent
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent boolean;
begin
  v_consent := coalesce((new.raw_user_meta_data->>'marketing_consent')::boolean, false);

  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    marketing_consent,
    marketing_consent_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    v_consent,
    case when v_consent = true then now() else null end
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    marketing_consent = excluded.marketing_consent,
    marketing_consent_at = coalesce(excluded.marketing_consent_at, public.profiles.marketing_consent_at),
    updated_at = now();

  return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- 2. SUBSCRIPTIONS TABLE
-- Connects Stripe subscription lifecycle directly to the organization workspace
-- ------------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade unique,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  plan text not null check (plan in ('starter', 'pro', 'enterprise')),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')),
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for fast query lookups during authorization and webhook syncing
create index if not exists idx_subscriptions_org on public.subscriptions(organization_id);
create index if not exists idx_subscriptions_customer on public.subscriptions(stripe_customer_id);
create index if not exists idx_subscriptions_sub_id on public.subscriptions(stripe_subscription_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);

-- Automated updated_at trigger for subscriptions
drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY ON SUBSCRIPTIONS
-- ------------------------------------------------------------------------------
alter table public.subscriptions enable row level security;

-- Read: Members of the organization can view the organization's subscription
drop policy if exists "Members can view their organization subscription" on public.subscriptions;
create policy "Members can view their organization subscription"
  on public.subscriptions
  for select
  using (public.is_org_member(organization_id));

-- Write: Restricted to organization owners and admins
drop policy if exists "Owners and admins can manage organization subscription" on public.subscriptions;
create policy "Owners and admins can manage organization subscription"
  on public.subscriptions
  for all
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));

-- ------------------------------------------------------------------------------
-- 4. SECURITY DEFINER FUNCTIONS FOR STRIPE WEBHOOK SYNC
-- Allows cryptographically verified webhook handlers to sync subscriptions
-- securely without needing a service role key.
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
  p_cancel_at_period_end boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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
    trial_start = excluded.trial_start,
    trial_end = excluded.trial_end,
    current_period_start = coalesce(excluded.current_period_start, public.subscriptions.current_period_start),
    current_period_end = coalesce(excluded.current_period_end, public.subscriptions.current_period_end),
    cancel_at_period_end = excluded.cancel_at_period_end,
    updated_at = now();
end;
$$;

create or replace function public.cancel_stripe_subscription(
  p_stripe_subscription_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscriptions
  set
    status = 'canceled',
    updated_at = now()
  where stripe_subscription_id = p_stripe_subscription_id;
end;
$$;
