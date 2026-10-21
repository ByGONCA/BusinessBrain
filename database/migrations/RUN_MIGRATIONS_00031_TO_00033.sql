-- ==============================================================================
-- Company Brain: Consolidated Staging Review Script (Migrations 00031 - 00033)
-- Target: Supabase PostgreSQL (Staging / Production)
-- File: RUN_MIGRATIONS_00031_TO_00033.sql
--
-- Security Profile:
-- - Wraps all DDL, RPC, and policy changes in an atomic transaction (BEGIN ... COMMIT).
-- - Implements strict Least Privilege: zero blanket CRUD grants, zero anon access.
-- - Protects organization metadata: Replaces permissive organization preview policy
--   with a dedicated SECURITY DEFINER RPC projecting only safe scalar fields (name, slug).
-- - Audited RLS interaction: Prevents invitees from inspecting sensitive organization
--   columns (stripe_customer_id, billing_email, onboarding_metadata).
-- - Effective privilege validation: Uses PostgreSQL native has_table_privilege() and
--   has_function_privilege() to audit direct, inherited, and default privileges.
-- - Explicit Rollback Distinction: Categorizes non-destructive vs destructive rollbacks.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PRE-EXECUTION CHECKS (Pre-conditions)
-- Verify required base tables exist before running DDL
-- ------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'organizations') then
    raise exception 'PRE-CONDITION FAILED: public.organizations table does not exist';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    raise exception 'PRE-CONDITION FAILED: public.profiles table does not exist';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'organization_invitations') then
    raise exception 'PRE-CONDITION FAILED: public.organization_invitations table does not exist';
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 2. MIGRATION 00031: ONBOARDING & TOUR TRACKING
-- ------------------------------------------------------------------------------

-- 2.1. Extend public.organizations
alter table public.organizations
  add column if not exists industry text,
  add column if not exists team_size text,
  add column if not exists onboarding_metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_organizations_industry on public.organizations(industry);

-- 2.2. Extend public.profiles
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists tour_completed boolean not null default false,
  add column if not exists tour_completed_at timestamptz,
  add column if not exists tour_step integer not null default 0,
  add column if not exists checklist_state jsonb not null default '{
    "page_created": false,
    "member_invited": false,
    "connection_explored": false,
    "settings_configured": false,
    "dismissed": false
  }'::jsonb;

create index if not exists idx_profiles_tour_completed on public.profiles(tour_completed);

-- 2.3. Documentation Comments
comment on column public.organizations.industry is 'Industry or business domain selected during onboarding';
comment on column public.organizations.team_size is 'Estimated team size category (e.g., 1, 2-10, 11-50, 51-200, 201+)';
comment on column public.organizations.onboarding_metadata is 'Flexible metadata including primary objectives and acquisition attribution';
comment on column public.profiles.tour_completed is 'Whether the user completed or dismissed the interactive guided tour';
comment on column public.profiles.tour_step is 'Last completed step in the in-app interactive tour';
comment on column public.profiles.checklist_state is 'Interactive first-use checklist progress';

-- ------------------------------------------------------------------------------
-- 3. MIGRATION 00032: ORGANIZATION WEBSITE URL
-- ------------------------------------------------------------------------------

alter table public.organizations
  add column if not exists website_url text;

comment on column public.organizations.website_url is 'Company website or live application URL (e.g. https://wareva.com)';

-- ------------------------------------------------------------------------------
-- 4. MIGRATION 00033: INVITATION DISCOVERY & SECURE PREVIEW GATEWAY
-- ------------------------------------------------------------------------------

-- 4.1. Policy on public.organization_invitations:
-- Allow authenticated users to view pending, valid invitations addressed strictly to their verified email.
drop policy if exists "invitees_select_own_invitations" on public.organization_invitations;
create policy "invitees_select_own_invitations"
  on public.organization_invitations
  for select
  to authenticated
  using (
    nullif(trim(coalesce(auth.jwt() ->> 'email', '')), '') is not null
    and lower(email) = lower(trim(auth.jwt() ->> 'email'))
    and status = 'pending'
    and expires_at > now()
  );

-- 4.2. Prevent Organization Column Leakage:
-- Drop any table-level SELECT policy for invitees on public.organizations.
-- Row-level security cannot restrict columns; granting SELECT on organizations
-- would expose stripe_customer_id, billing_email, and onboarding_metadata to invitees.
drop policy if exists "invitees_select_organization_preview" on public.organizations;

-- 4.3. Secure Read Gateway: public.get_my_pending_invitations
-- Projects ONLY safe preview fields (name, slug) joined strictly on caller's verified JWT email.
create or replace function public.get_my_pending_invitations()
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  email text,
  role text,
  status text,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public, extensions, pg_temp
as $$
  select
    oi.id,
    oi.organization_id,
    o.name as organization_name,
    o.slug as organization_slug,
    oi.email,
    oi.role,
    oi.status,
    oi.expires_at,
    oi.created_at
  from public.organization_invitations oi
  join public.organizations o on o.id = oi.organization_id
  where nullif(trim(coalesce(auth.jwt() ->> 'email', '')), '') is not null
    and lower(oi.email) = lower(trim(auth.jwt() ->> 'email'))
    and oi.status = 'pending'
    and oi.expires_at > now();
$$;

comment on function public.get_my_pending_invitations() is
  'Returns safe preview fields for invitations addressed to the calling authenticated user, without exposing sensitive organization columns.';

-- 4.4. Explicit Function Execution Grants
revoke all on function public.get_my_pending_invitations() from public, anon;
grant execute on function public.get_my_pending_invitations() to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. EXPLICIT DATA API PRIVILEGES (LEAST PRIVILEGE ENFORCEMENT)
-- Only grant operations actually used by application code.
-- Zero broad CRUD. No ALTER DEFAULT PRIVILEGES.
-- ------------------------------------------------------------------------------

-- 5.1. public.organizations
-- authenticated: SELECT (active members), INSERT (workspace creation), UPDATE (settings/metadata)
-- DELETE is strictly withheld from authenticated.
revoke all on table public.organizations from public, anon;
revoke delete on table public.organizations from authenticated;
grant select, insert, update on table public.organizations to authenticated;
grant all on table public.organizations to service_role;

-- 5.2. public.profiles
-- authenticated: SELECT (self & peers), INSERT (initial creation), UPDATE (profile & tour state)
-- DELETE is strictly withheld from authenticated.
revoke all on table public.profiles from public, anon;
revoke delete on table public.profiles from authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

-- 5.3. public.organization_invitations
-- authenticated: SELECT (member management & recipient discovery), INSERT (inviting new members), UPDATE (revoking/updating status)
-- DELETE is strictly withheld from authenticated (invitations are revoked via status update, never deleted).
revoke all on table public.organization_invitations from public, anon;
revoke delete on table public.organization_invitations from authenticated;
grant select, insert, update on table public.organization_invitations to authenticated;
grant all on table public.organization_invitations to service_role;

-- ------------------------------------------------------------------------------
-- 6. POST-EXECUTION VERIFICATION ASSERTIONS
-- Validates schema, columns, RLS policies, functions, and effective role privileges.
-- Aborts transaction immediately if any verification fails.
-- ------------------------------------------------------------------------------
do $$
declare
  v_missing text := '';
begin
  -- 6.1. Verify Column Additions in organizations
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'website_url') then
    v_missing := v_missing || ' organizations.website_url;';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'industry') then
    v_missing := v_missing || ' organizations.industry;';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'team_size') then
    v_missing := v_missing || ' organizations.team_size;';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'onboarding_metadata') then
    v_missing := v_missing || ' organizations.onboarding_metadata;';
  end if;

  -- 6.2. Verify Column Additions in profiles
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'tour_completed') then
    v_missing := v_missing || ' profiles.tour_completed;';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'checklist_state') then
    v_missing := v_missing || ' profiles.checklist_state;';
  end if;

  -- 6.3. Verify Indexes
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'organizations' and indexname = 'idx_organizations_industry') then
    v_missing := v_missing || ' index idx_organizations_industry;';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'profiles' and indexname = 'idx_profiles_tour_completed') then
    v_missing := v_missing || ' index idx_profiles_tour_completed;';
  end if;

  -- 6.4. Verify RLS Policies
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'organization_invitations' and policyname = 'invitees_select_own_invitations') then
    v_missing := v_missing || ' policy invitees_select_own_invitations;';
  end if;
  -- Ensure the insecure policy is NOT present
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'organizations' and policyname = 'invitees_select_organization_preview') then
    raise exception 'SECURITY VIOLATION: Insecure policy invitees_select_organization_preview still exists on public.organizations';
  end if;

  -- 6.5. Verify Function Existence & Security Definer Configuration
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_my_pending_invitations' and p.prosecdef = true
  ) then
    v_missing := v_missing || ' function public.get_my_pending_invitations (SECURITY DEFINER);';
  end if;

  if length(v_missing) > 0 then
    raise exception 'POST-VERIFICATION FAILED: Missing objects:%', v_missing;
  end if;

  -- 6.6. Verify Effective Table Privileges via PostgreSQL native has_table_privilege()
  -- (Tests direct, inherited, and PUBLIC grants)
  if has_table_privilege('anon', 'public.organizations', 'select')
     or has_table_privilege('anon', 'public.organizations', 'insert')
     or has_table_privilege('anon', 'public.organizations', 'update')
     or has_table_privilege('anon', 'public.organizations', 'delete') then
    raise exception 'SECURITY VIOLATION: anon has effective table privileges on organizations';
  end if;

  if has_table_privilege('anon', 'public.profiles', 'select')
     or has_table_privilege('anon', 'public.profiles', 'insert')
     or has_table_privilege('anon', 'public.profiles', 'update')
     or has_table_privilege('anon', 'public.profiles', 'delete') then
    raise exception 'SECURITY VIOLATION: anon has effective table privileges on profiles';
  end if;

  if has_table_privilege('anon', 'public.organization_invitations', 'select')
     or has_table_privilege('anon', 'public.organization_invitations', 'insert')
     or has_table_privilege('anon', 'public.organization_invitations', 'update')
     or has_table_privilege('anon', 'public.organization_invitations', 'delete') then
    raise exception 'SECURITY VIOLATION: anon has effective table privileges on organization_invitations';
  end if;

  -- Verify authenticated has NO delete privilege on these tables
  if has_table_privilege('authenticated', 'public.organizations', 'delete') then
    raise exception 'SECURITY VIOLATION: authenticated has unintended DELETE privilege on organizations';
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'delete') then
    raise exception 'SECURITY VIOLATION: authenticated has unintended DELETE privilege on profiles';
  end if;
  if has_table_privilege('authenticated', 'public.organization_invitations', 'delete') then
    raise exception 'SECURITY VIOLATION: authenticated has unintended DELETE privilege on organization_invitations';
  end if;

  -- 6.7. Verify Effective Function Privileges
  if has_function_privilege('anon', 'public.get_my_pending_invitations()', 'execute') then
    raise exception 'SECURITY VIOLATION: anon has EXECUTE privilege on public.get_my_pending_invitations';
  end if;
  if not has_function_privilege('authenticated', 'public.get_my_pending_invitations()', 'execute') then
    raise exception 'SECURITY VIOLATION: authenticated lacks EXECUTE privilege on public.get_my_pending_invitations';
  end if;

  raise notice 'POST-VERIFICATION PASSED: Migrations 00031-00033 applied cleanly, RLS enforced, RPC secured, and effective privileges verified.';
end $$;

COMMIT;

-- ==============================================================================
-- 7. DISASTER RECOVERY & ROLLBACK PROCEDURES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 7.1. PROCEDURE A: SAFE / METADATA-PRESERVING ROLLBACK (RECOMMENDED)
-- Reverts RLS policies and RPC without dropping columns or destroying user data.
-- ------------------------------------------------------------------------------
/*
BEGIN;

-- Revoke and drop RPC
drop function if exists public.get_my_pending_invitations();

-- Drop invitee policy
drop policy if exists "invitees_select_own_invitations" on public.organization_invitations;

COMMIT;
*/

-- ------------------------------------------------------------------------------
-- 7.2. PROCEDURE B: DESTRUCTIVE DATA-PURGE ROLLBACK (REQUIRES BACKUP)
-- WARNING: Executing this block PERMANENTLY DESTROYS all stored user onboarding
-- choices, industry domain selections, team sizes, website URLs, and checklist states!
-- DO NOT EXECUTE without an explicit pre-rollback database backup and confirmation.
-- ------------------------------------------------------------------------------
/*
BEGIN;

-- Step 1: Drop RPC and policies
drop function if exists public.get_my_pending_invitations();
drop policy if exists "invitees_select_own_invitations" on public.organization_invitations;

-- Step 2: Drop Indexes
drop index if exists public.idx_profiles_tour_completed;
drop index if exists public.idx_organizations_industry;

-- Step 3: Physically Drop Columns (PERMANENT DATA LOSS)
alter table public.profiles
  drop column if exists checklist_state,
  drop column if exists tour_step,
  drop column if exists tour_completed_at,
  drop column if exists tour_completed,
  drop column if exists onboarding_completed_at,
  drop column if exists onboarding_completed;

alter table public.organizations
  drop column if exists website_url,
  drop column if exists onboarding_metadata,
  drop column if exists team_size,
  drop column if exists industry;

COMMIT;
*/
