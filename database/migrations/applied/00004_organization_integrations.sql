-- ==============================================================================
-- Company Brain: Organization Integrations (Google Workspace, Calendar, Gmail)
-- Migration: 00004_organization_integrations.sql
-- ==============================================================================

create table if not exists public.organization_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null, -- 'google', 'microsoft', etc.
  provider_account_id text, -- unique account ID from provider (e.g. sub or email)
  account_email text,
  connected_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error', 'needs_reauth')),
  scopes text[] not null default '{}',
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_org_provider_account unique (organization_id, provider, provider_account_id)
);

create index if not exists idx_org_integrations_org on public.organization_integrations(organization_id);
create index if not exists idx_org_integrations_provider on public.organization_integrations(provider);
create index if not exists idx_org_integrations_status on public.organization_integrations(status);

alter table public.organization_integrations enable row level security;

-- Trigger for automated updated_at timestamp
drop trigger if exists set_org_integrations_updated_at on public.organization_integrations;
create trigger set_org_integrations_updated_at
  before update on public.organization_integrations
  for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- RLS POLICIES FOR ORGANIZATION INTEGRATIONS
-- ------------------------------------------------------------------------------

-- Members of the organization can view active integrations for their workspace
drop policy if exists "Members can view organization integrations" on public.organization_integrations;
create policy "Members can view organization integrations"
  on public.organization_integrations
  for select
  using (public.is_org_member(organization_id));

-- Owners and admins can manage (insert/update/delete) integrations for their workspace
drop policy if exists "Owners and admins can manage organization integrations" on public.organization_integrations;
create policy "Owners and admins can manage organization integrations"
  on public.organization_integrations
  for all
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));

-- Reload schema cache
notify pgrst, 'reload schema';
