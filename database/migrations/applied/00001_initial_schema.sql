-- ==============================================================================
-- Company Brain: Initial Database Schema (Phase 0 Foundation)
-- Migration: 00001_initial_schema.sql
-- ==============================================================================

-- Enable UUID extension if not enabled
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- Extends Supabase auth.users with application-level profile data
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ------------------------------------------------------------------------------
-- 2. ORGANIZATIONS TABLE
-- Represents a company or workspace entity (multi-tenant boundary)
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
-- Connects users to organizations with assigned role
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
-- 4. AUTOMATED TIMESTAMP TRIGGER
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

-- ------------------------------------------------------------------------------
-- 5. NEW USER PROFILE SYNC TRIGGER
-- Automatically creates a profile record when a user signs up via Supabase Auth
-- ------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
