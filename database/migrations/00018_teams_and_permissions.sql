-- ==============================================================================
-- Company Brain: Teams & Flexible Granular Permissions System
-- Migration: 00018_teams_and_permissions.sql
-- Description:
--   Discord-style flexible permission model:
--   - Workspaces have Owners (root authority).
--   - Arbitrary Teams with member associations.
--   - Team-level permissions and explicit individual member overrides (allow/deny).
--   - Job titles and departments are purely informational.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. INFORMATIONAL PROFILE FIELDS
-- Job title, department, bio, and location (strictly informational).
-- ------------------------------------------------------------------------------
alter table if exists public.profiles
  add column if not exists job_title text default '',
  add column if not exists department text default '',
  add column if not exists bio text default '',
  add column if not exists location text default '';

alter table if exists public.organization_members
  add column if not exists job_title text default '',
  add column if not exists department text default '';

-- ------------------------------------------------------------------------------
-- 2. ORGANIZATION TEAMS TABLE
-- Stores arbitrary, user-defined teams within an organization.
-- ------------------------------------------------------------------------------
create table if not exists public.organization_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text default '',
  color text not null default 'blue',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_org_teams_org on public.organization_teams(organization_id);
create index if not exists idx_org_teams_name on public.organization_teams(organization_id, name);

alter table public.organization_teams enable row level security;

-- Strict Multi-Tenant Policies for Teams
drop policy if exists "Members can view teams in active org" on public.organization_teams;
create policy "Members can view teams in active org"
  on public.organization_teams for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "Members with team permissions can insert teams" on public.organization_teams;
create policy "Members with team permissions can insert teams"
  on public.organization_teams for insert
  to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "Members with team permissions can update teams" on public.organization_teams;
create policy "Members with team permissions can update teams"
  on public.organization_teams for update
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Members with team permissions can delete teams" on public.organization_teams;
create policy "Members with team permissions can delete teams"
  on public.organization_teams for delete
  to authenticated
  using (public.is_org_member(organization_id));

-- ------------------------------------------------------------------------------
-- 3. ORGANIZATION TEAM MEMBERS TABLE
-- Associates organization members with teams.
-- ------------------------------------------------------------------------------
create table if not exists public.organization_team_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.organization_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint uq_team_user unique (team_id, user_id)
);

create index if not exists idx_team_members_org on public.organization_team_members(organization_id);
create index if not exists idx_team_members_team on public.organization_team_members(team_id);
create index if not exists idx_team_members_user on public.organization_team_members(user_id);

alter table public.organization_team_members enable row level security;

drop policy if exists "Members can view team members in active org" on public.organization_team_members;
create policy "Members can view team members in active org"
  on public.organization_team_members for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "Authorized members can manage team memberships" on public.organization_team_members;
create policy "Authorized members can manage team memberships"
  on public.organization_team_members for insert
  to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "Authorized members can remove team memberships" on public.organization_team_members;
create policy "Authorized members can remove team memberships"
  on public.organization_team_members for delete
  to authenticated
  using (public.is_org_member(organization_id));

-- ------------------------------------------------------------------------------
-- 4. TEAM PERMISSIONS TABLE
-- Maps permission keys granted to a specific team.
-- ------------------------------------------------------------------------------
create table if not exists public.team_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.organization_teams(id) on delete cascade,
  permission_key text not null,
  created_at timestamptz not null default now(),
  constraint uq_team_permission unique (team_id, permission_key)
);

create index if not exists idx_team_perms_org on public.team_permissions(organization_id);
create index if not exists idx_team_perms_team on public.team_permissions(team_id);
create index if not exists idx_team_perms_key on public.team_permissions(organization_id, permission_key);

alter table public.team_permissions enable row level security;

drop policy if exists "Members can view team permissions in active org" on public.team_permissions;
create policy "Members can view team permissions in active org"
  on public.team_permissions for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "Authorized members can insert team permissions" on public.team_permissions;
create policy "Authorized members can insert team permissions"
  on public.team_permissions for insert
  to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "Authorized members can delete team permissions" on public.team_permissions;
create policy "Authorized members can delete team permissions"
  on public.team_permissions for delete
  to authenticated
  using (public.is_org_member(organization_id));

-- ------------------------------------------------------------------------------
-- 5. MEMBER PERMISSION OVERRIDES TABLE
-- Explicit individual ALLOW or DENY overrides per member.
-- ------------------------------------------------------------------------------
create table if not exists public.member_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null,
  effect text not null check (effect in ('allow', 'deny')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_member_perm_override unique (organization_id, user_id, permission_key)
);

create index if not exists idx_member_overrides_org on public.member_permission_overrides(organization_id);
create index if not exists idx_member_overrides_user on public.member_permission_overrides(organization_id, user_id);

alter table public.member_permission_overrides enable row level security;

drop policy if exists "Members can view permission overrides in active org" on public.member_permission_overrides;
create policy "Members can view permission overrides in active org"
  on public.member_permission_overrides for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "Authorized members can insert permission overrides" on public.member_permission_overrides;
create policy "Authorized members can insert permission overrides"
  on public.member_permission_overrides for insert
  to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "Authorized members can update permission overrides" on public.member_permission_overrides;
create policy "Authorized members can update permission overrides"
  on public.member_permission_overrides for update
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Authorized members can delete permission overrides" on public.member_permission_overrides;
create policy "Authorized members can delete permission overrides"
  on public.member_permission_overrides for delete
  to authenticated
  using (public.is_org_member(organization_id));

-- ------------------------------------------------------------------------------
-- 6. RESOURCE PERMISSIONS TABLE (OPTIONAL / EXTENSIBLE)
-- Fine-grained access control for specific BusinessBrain resources.
-- ------------------------------------------------------------------------------
create table if not exists public.resource_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resource_type text not null, -- 'page', 'project', 'repo', etc.
  resource_id text not null,   -- UUID or string key
  grantee_type text not null check (grantee_type in ('team', 'user')),
  grantee_id uuid not null,
  access_level text not null check (access_level in ('view', 'edit', 'admin')),
  created_at timestamptz not null default now(),
  constraint uq_resource_permission unique (organization_id, resource_type, resource_id, grantee_type, grantee_id)
);

create index if not exists idx_resource_perms_lookup
  on public.resource_permissions(organization_id, resource_type, resource_id);

alter table public.resource_permissions enable row level security;

drop policy if exists "Members can view resource permissions in active org" on public.resource_permissions;
create policy "Members can view resource permissions in active org"
  on public.resource_permissions for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "Authorized members can manage resource permissions" on public.resource_permissions;
create policy "Authorized members can manage resource permissions"
  on public.resource_permissions for insert
  to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "Authorized members can delete resource permissions" on public.resource_permissions;
create policy "Authorized members can delete resource permissions"
  on public.resource_permissions for delete
  to authenticated
  using (public.is_org_member(organization_id));

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
