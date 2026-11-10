-- ==============================================================================
-- Company Brain: Organization Metric Snapshots & OAuth Nonce Ledger
-- Migration: 00027_organization_metric_snapshots.sql
-- Description: Lean aggregation storage for Stripe business metrics (1 row per org)
--              and anti-replay nonce tracking for OAuth Connect security.
-- ==============================================================================

-- 1. Organization Metric Snapshots (Lean Multi-Instance Shared Cache)
create table if not exists public.organization_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric_type text not null default 'stripe_financial_overview',
  payload jsonb not null default '{}'::jsonb,
  currency_summaries jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  status text not null default 'fresh' check (status in ('fresh', 'stale', 'expired', 'syncing', 'error')),
  checksum text not null default '',
  payload_size_bytes integer not null default 0,
  sync_lock_until timestamptz, -- Lease-based mutex for multi-instance concurrency
  sync_locked_by text, -- Instance or request identifier holding the lease
  error_details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_org_metric_type unique (organization_id, metric_type)
);

create index if not exists idx_org_metric_snapshots_org on public.organization_metric_snapshots(organization_id);
create index if not exists idx_org_metric_snapshots_status on public.organization_metric_snapshots(status);
create index if not exists idx_org_metric_snapshots_expires on public.organization_metric_snapshots(expires_at);

alter table public.organization_metric_snapshots enable row level security;

-- Updated at trigger
drop trigger if exists set_org_metric_snapshots_updated_at on public.organization_metric_snapshots;
create trigger set_org_metric_snapshots_updated_at
  before update on public.organization_metric_snapshots
  for each row execute function public.handle_updated_at();

-- RLS: All members of the organization can view the aggregated business metrics
drop policy if exists "Members can view organization metric snapshot" on public.organization_metric_snapshots;
create policy "Members can view organization metric snapshot"
  on public.organization_metric_snapshots
  for select
  using (public.is_org_member(organization_id));

-- RLS: Only Owners and Admins can insert, update, or delete snapshots (or refresh them)
drop policy if exists "Owners and admins can manage metric snapshots" on public.organization_metric_snapshots;
create policy "Owners and admins can manage metric snapshots"
  on public.organization_metric_snapshots
  for all
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));

-- 2. OAuth Nonce Ledger (Anti-Replay Protection)
create table if not exists public.oauth_nonce_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nonce text not null,
  provider text not null default 'stripe',
  created_by_user_id uuid references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint uq_oauth_nonce_provider unique (provider, nonce)
);

create index if not exists idx_oauth_nonce_expires on public.oauth_nonce_ledger(expires_at);
create index if not exists idx_oauth_nonce_lookup on public.oauth_nonce_ledger(provider, nonce);

alter table public.oauth_nonce_ledger enable row level security;

-- Only Owners and Admins can create/consume OAuth nonces
drop policy if exists "Owners and admins can manage oauth nonces" on public.oauth_nonce_ledger;
create policy "Owners and admins can manage oauth nonces"
  on public.oauth_nonce_ledger
  for all
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));

-- Reload schema cache
notify pgrst, 'reload schema';
