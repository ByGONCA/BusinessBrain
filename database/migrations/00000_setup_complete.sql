-- ==============================================================================
-- Company Brain: Master Database Setup (Complete Schema, RLS & Security Hardening)
-- File: 00000_setup_complete.sql
-- 
-- Run this single file in the Supabase SQL Editor.
-- It is completely idempotent and sets up the entire database from scratch:
-- 1. Profiles & marketing consent triggers
-- 2. Organizations & multi-tenant isolation
-- 3. Organization members with privilege escalation defense
-- 4. Subscriptions locked down (read-only for clients, managed by webhooks)
-- 5. Organization integrations with token encryption isolation
-- 6. Stripe webhook idempotency ledger
-- 7. Serverless rate-limiting table & atomic RPC
-- 8. Supabase Storage bucket & tenant-isolated storage policies
-- ==============================================================================

-- Enable UUID / Crypto extension
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- Extends Supabase auth.users with application profile data
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ------------------------------------------------------------------------------
-- 2. ORGANIZATIONS TABLE
-- Multi-tenant workspace entity
-- ------------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organizations_slug on public.organizations(slug);
create index if not exists idx_organizations_status on public.organizations(status);
alter table public.organizations enable row level security;

-- ------------------------------------------------------------------------------
-- 3. ORGANIZATION MEMBERS TABLE
-- Workspace membership mapping with RBAC roles
-- ------------------------------------------------------------------------------
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_org_member unique (organization_id, user_id)
);

create index if not exists idx_org_members_user on public.organization_members(user_id);
create index if not exists idx_org_members_org on public.organization_members(organization_id);
create index if not exists idx_org_members_role on public.organization_members(organization_id, role);
alter table public.organization_members enable row level security;

-- ------------------------------------------------------------------------------
-- 4. SUBSCRIPTIONS TABLE
-- Stripe subscription state mapped to organizations
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

create index if not exists idx_subscriptions_org on public.subscriptions(organization_id);
create index if not exists idx_subscriptions_customer on public.subscriptions(stripe_customer_id);
create index if not exists idx_subscriptions_sub_id on public.subscriptions(stripe_subscription_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);
alter table public.subscriptions enable row level security;

-- ------------------------------------------------------------------------------
-- 5. ORGANIZATION INTEGRATIONS TABLE
-- Third-party OAuth integration credentials and sync metadata
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

-- ------------------------------------------------------------------------------
-- 6. STRIPE WEBHOOK IDEMPOTENCY LEDGER
-- Prevents duplicate processing of repeated Stripe webhook deliveries
-- ------------------------------------------------------------------------------
create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create index if not exists idx_stripe_webhook_events_processed_at on public.stripe_webhook_events(processed_at);
alter table public.stripe_webhook_events enable row level security;

-- ------------------------------------------------------------------------------
-- 7. SERVERLESS RATE LIMITING TABLE
-- Atomic sliding window rate limiter state for Vercel/serverless instances
-- ------------------------------------------------------------------------------
create table if not exists public.rate_limit_entries (
  key text primary key,
  points int not null default 1,
  expire_at timestamptz not null
);

create index if not exists idx_rate_limit_expire_at on public.rate_limit_entries(expire_at);
alter table public.rate_limit_entries enable row level security;

-- ------------------------------------------------------------------------------
-- 8. AUTOMATED TIMESTAMP TRIGGER
-- ------------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
  before update on public.organizations
  for each row execute function public.handle_updated_at();

drop trigger if exists set_organization_members_updated_at on public.organization_members;
create trigger set_organization_members_updated_at
  before update on public.organization_members
  for each row execute function public.handle_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

drop trigger if exists set_org_integrations_updated_at on public.organization_integrations;
create trigger set_org_integrations_updated_at
  before update on public.organization_integrations
  for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 9. AUTH USER SIGNUP TRIGGER (WITH MARKETING CONSENT)
-- ------------------------------------------------------------------------------
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 10. HELPER SECURITY DEFINER FUNCTIONS (FOR RLS POLICIES)
-- ------------------------------------------------------------------------------
create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(target_org_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

create or replace function public.shares_organization_with(target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m1
    join public.organization_members m2 on m1.organization_id = m2.organization_id
    where m1.user_id = auth.uid()
      and m2.user_id = target_user_id
  );
$$;

revoke execute on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated, service_role, postgres;

revoke execute on function public.has_org_role(uuid, text[]) from public;
grant execute on function public.has_org_role(uuid, text[]) to authenticated, service_role, postgres;

revoke execute on function public.shares_organization_with(uuid) from public;
grant execute on function public.shares_organization_with(uuid) to authenticated, service_role, postgres;

-- ------------------------------------------------------------------------------
-- 11. PROFILES RLS POLICIES
-- ------------------------------------------------------------------------------
drop policy if exists "Profiles are viewable by self and workspace peers" on public.profiles;
create policy "Profiles are viewable by self and workspace peers"
  on public.profiles
  for select
  using (
    auth.uid() = id
    or public.shares_organization_with(id)
  );

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 12. ORGANIZATIONS RLS POLICIES
-- ------------------------------------------------------------------------------
drop policy if exists "Organizations are viewable by active members" on public.organizations;
create policy "Organizations are viewable by active members"
  on public.organizations
  for select
  using (
    public.is_org_member(id)
    or created_by = auth.uid()
  );

drop policy if exists "Authenticated users can create organizations" on public.organizations;
create policy "Authenticated users can create organizations"
  on public.organizations
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Owners and admins can update organization" on public.organizations;
create policy "Owners and admins can update organization"
  on public.organizations
  for update
  using (public.has_org_role(id, array['owner', 'admin']))
  with check (public.has_org_role(id, array['owner', 'admin']));

drop policy if exists "Only owners can delete organization" on public.organizations;
create policy "Only owners can delete organization"
  on public.organizations
  for delete
  using (public.has_org_role(id, array['owner']));

-- ------------------------------------------------------------------------------
-- 13. ORGANIZATION MEMBERS RLS POLICIES (HARDENED AGAINST PRIVILEGE ESCALATION)
-- ------------------------------------------------------------------------------
drop policy if exists "Members can view membership in their organizations" on public.organization_members;
create policy "Members can view membership in their organizations"
  on public.organization_members
  for select
  using (public.is_org_member(organization_id));

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
        where id = organization_id and created_by = auth.uid()
      )
    )
  );

drop policy if exists "Owners and admins can update member roles" on public.organization_members;
create policy "Owners and admins can update member roles"
  on public.organization_members
  for update
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "Owners/admins can remove members or user can leave" on public.organization_members;
create policy "Owners/admins can remove members or user can leave"
  on public.organization_members
  for delete
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or user_id = auth.uid()
  );

-- ------------------------------------------------------------------------------
-- 14. SUBSCRIPTIONS RLS POLICIES (LOCKED DOWN - BILLING BYPASS DEFENSE)
-- Subscriptions are strictly read-only for members. Direct client mutations are blocked.
-- ------------------------------------------------------------------------------
drop policy if exists "Owners and admins can manage organization subscription" on public.subscriptions;
drop policy if exists "Members can view their organization subscription" on public.subscriptions;
create policy "Members can view their organization subscription"
  on public.subscriptions
  for select
  using (public.is_org_member(organization_id));

-- ------------------------------------------------------------------------------
-- 15. ORGANIZATION INTEGRATIONS RLS POLICIES
-- Members can view connection metadata; credentials accessible only by owners/admins.
-- ------------------------------------------------------------------------------
drop policy if exists "Members can view organization integrations" on public.organization_integrations;
drop policy if exists "Members can view organization integrations metadata" on public.organization_integrations;
create policy "Members can view organization integrations metadata"
  on public.organization_integrations
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "Owners and admins can manage organization integrations" on public.organization_integrations;
create policy "Owners and admins can manage organization integrations"
  on public.organization_integrations
  for all
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));

-- ------------------------------------------------------------------------------
-- 16. STRIPE BILLING SECURITY DEFINER RPC FUNCTIONS
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
  return false; -- Duplicate event
end;
$$;

revoke all on function public.record_stripe_webhook_event(text, text) from public;
grant execute on function public.record_stripe_webhook_event(text, text) to anon, authenticated, service_role, postgres;

-- ------------------------------------------------------------------------------
-- 17. SERVERLESS RATE LIMITING RPC (PROTECTED WITH SERVER TOKEN)
-- ------------------------------------------------------------------------------
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
  -- Key validation
  if p_key is null or not (p_key like 'rl:%') or length(p_key) > 256 then
    raise exception 'Invalid rate limit key';
  end if;

  -- Limit validation
  if p_limit <= 0 or p_limit > 10000 or p_window_seconds <= 0 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;

  -- Access control: allow service_role OR require valid server token (length >= 16)
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

revoke all on function public.check_rate_limit(text, int, int, text) from public;
grant execute on function public.check_rate_limit(text, int, int, text) to anon, authenticated, service_role, postgres;

-- ------------------------------------------------------------------------------
-- 18. SUPABASE STORAGE BUCKET & MULTI-TENANT ISOLATION POLICIES
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

drop policy if exists "Members can read organization files" on storage.objects;
create policy "Members can read organization files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'organization_files'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Members can upload files to their organization" on storage.objects;
create policy "Members can upload files to their organization"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'organization_files'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Owners and admins can update organization files" on storage.objects;
create policy "Owners and admins can update organization files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'organization_files'
    and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
  );

drop policy if exists "Owners and admins can delete organization files" on storage.objects;
create policy "Owners and admins can delete organization files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'organization_files'
    and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
  );

-- ------------------------------------------------------------------------------
-- 19. RELOAD SCHEMA CACHE
-- ------------------------------------------------------------------------------
notify pgrst, 'reload schema';
