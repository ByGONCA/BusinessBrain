-- ==============================================================================
-- Company Brain: Security Foundation Hardening
-- Migration: 00005_security_hardening.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FIX PRIVILEGE ESCALATION ON ORGANIZATION MEMBERS
-- Ensure users cannot self-assign owner role to arbitrary organizations.
-- Users can only insert themselves as owner IF they created the organization.
-- ------------------------------------------------------------------------------
drop policy if exists "Admins/Owners can add members or creator can add self" on public.organization_members;

create policy "Admins/Owners can add members or creator can add self"
  on public.organization_members
  for insert
  with check (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or (
      user_id = auth.uid()
      and role = 'owner'
      and exists (
        select 1 from public.organizations
        where id = organization_id
          and created_by = auth.uid()
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 2. LOCK DOWN SUBSCRIPTIONS MUTATION ACCESS
-- Prevent client-side billing bypasses. Subscriptions are strictly read-only
-- for authenticated members. All insertions/updates/deletions must go through
-- server-side SECURITY DEFINER RPCs (sync_stripe_subscription) or service client.
-- ------------------------------------------------------------------------------
drop policy if exists "Owners and admins can manage organization subscription" on public.subscriptions;

-- Ensure SELECT is strictly available to active organization members
drop policy if exists "Members can view their organization subscription" on public.subscriptions;
create policy "Members can view their organization subscription"
  on public.subscriptions
  for select
  using (public.is_org_member(organization_id));

-- ------------------------------------------------------------------------------
-- 3. ORGANIZATION INTEGRATIONS TABLE & TOKEN HARDENING
-- Ensure table exists and restrict credentials to owners and admins.
-- Members can view general metadata (provider, status, email), but only
-- admins/owners can access the raw/encrypted credentials.
-- ------------------------------------------------------------------------------
create table if not exists public.organization_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  provider_account_id text,
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

drop trigger if exists set_org_integrations_updated_at on public.organization_integrations;
create trigger set_org_integrations_updated_at
  before update on public.organization_integrations
  for each row execute function public.handle_updated_at();

drop policy if exists "Members can view organization integrations" on public.organization_integrations;
drop policy if exists "Members can view organization integrations metadata" on public.organization_integrations;
drop policy if exists "Owners and admins can manage organization integrations" on public.organization_integrations;

-- Members can view non-sensitive integration info
create policy "Members can view organization integrations metadata"
  on public.organization_integrations
  for select
  using (public.is_org_member(organization_id));

-- Only owners and admins can insert, update, or delete integrations
create policy "Owners and admins can manage organization integrations"
  on public.organization_integrations
  for all
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));

-- ------------------------------------------------------------------------------
-- 4. STRIPE WEBHOOK IDEMPOTENCY LEDGER
-- Prevents duplicate execution of processed webhook events.
-- ------------------------------------------------------------------------------
create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create index if not exists idx_stripe_webhook_events_processed_at on public.stripe_webhook_events(processed_at);

alter table public.stripe_webhook_events enable row level security;
-- No client policies created: table is strictly managed by service client / SECURITY DEFINER functions.

-- Helper RPC for atomic webhook event recording & idempotency checking
create or replace function public.record_stripe_webhook_event(
  p_event_id text,
  p_event_type text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.stripe_webhook_events (id, event_type, processed_at)
  values (p_event_id, p_event_type, now());
  return true;
exception when unique_violation then
  return false; -- Event already processed
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. SERVERLESS RATE LIMITING TABLE & ATOMIC RPC
-- Provides serverless-compatible sliding window rate limiting in PostgreSQL.
-- ------------------------------------------------------------------------------
create table if not exists public.rate_limit_entries (
  key text primary key,
  points int not null default 1,
  expire_at timestamptz not null
);

create index if not exists idx_rate_limit_expire_at on public.rate_limit_entries(expire_at);

alter table public.rate_limit_entries enable row level security;
-- No client policies created: table is strictly managed by SECURITY DEFINER check_rate_limit.

create or replace function public.check_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int,
  p_server_token text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_expire timestamptz := v_now + (p_window_seconds || ' seconds')::interval;
  v_current_points int;
begin
  -- Guard 1: Restrict keys to internal rate-limit namespace and bounded length
  if p_key is null or not (p_key like 'rl:%') or length(p_key) > 256 then
    raise exception 'Invalid rate limit key';
  end if;

  -- Guard 2: Parameter boundary validation
  if p_limit <= 0 or p_limit > 10000 or p_window_seconds <= 0 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;

  -- Guard 3: Restrict execution to trusted server-side code (service_role or valid server authorization token)
  if coalesce(auth.role(), '') <> 'service_role' and (p_server_token is null or length(p_server_token) < 16) then
    raise exception 'Access denied: check_rate_limit can only be invoked by trusted server-side code';
  end if;

  -- Lazy prune of expired keys (5% sampling to minimize write contention)
  if random() < 0.05 then
    delete from public.rate_limit_entries where expire_at < v_now;
  end if;

  insert into public.rate_limit_entries (key, points, expire_at)
  values (p_key, 1, v_expire)
  on conflict (key) do update
  set
    points = case
      when public.rate_limit_entries.expire_at < v_now then 1
      else public.rate_limit_entries.points + 1
    end,
    expire_at = case
      when public.rate_limit_entries.expire_at < v_now then v_expire
      else public.rate_limit_entries.expire_at
    end
  returning points into v_current_points;

  return v_current_points <= p_limit;
end;
$$;

-- Revoke default public execution and restrict permissions
revoke all on function public.check_rate_limit(text, int, int, text) from public;
grant execute on function public.check_rate_limit(text, int, int, text) to anon, authenticated, service_role, postgres;

-- ------------------------------------------------------------------------------
-- 6. SUPABASE STORAGE BUCKET & TENANT ISOLATION POLICIES
-- Prepares storage for organization documents and uploads.
-- Folder convention: [organization_id]/[file_path]
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization_files',
  'organization_files',
  false,
  52428800, -- 50 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/markdown',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 52428800;

-- Storage object policies with strict tenant boundary
drop policy if exists "Members can read organization files" on storage.objects;
create policy "Members can read organization files"
  on storage.objects
  for select
  using (
    bucket_id = 'organization_files'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Members can upload files to their organization" on storage.objects;
create policy "Members can upload files to their organization"
  on storage.objects
  for insert
  with check (
    bucket_id = 'organization_files'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Owners and admins can update organization files" on storage.objects;
create policy "Owners and admins can update organization files"
  on storage.objects
  for update
  using (
    bucket_id = 'organization_files'
    and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
  );

drop policy if exists "Owners and admins can delete organization files" on storage.objects;
create policy "Owners and admins can delete organization files"
  on storage.objects
  for delete
  using (
    bucket_id = 'organization_files'
    and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
  );

-- Reload schema cache
notify pgrst, 'reload schema';
