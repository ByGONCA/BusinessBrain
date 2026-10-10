-- ==============================================================================
-- Company Brain: Consolidated Migrations (00013 to 00018)
-- Safe, idempotent execution for Supabase SQL Editor.
-- Covers Calendar (00013), Settings & Notifications (00014), Extended Settings & Audit (00015),
-- Page Authorship (00016), GitHub Integration (00017), and Teams & Permissions (00018).
-- You can run this entire script once in the Supabase SQL Editor.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- MIGRATION 00013: Organization Calendar Events
-- ------------------------------------------------------------------------------
create table if not exists public.organization_calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  all_day boolean default false,
  tag text default 'Work',
  color text default 'blue',
  location text,
  meeting_link text,
  attendees text[] default '{}',
  source text default 'internal',
  external_event_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_calendar_events_org_start
  on public.organization_calendar_events(organization_id, start_time);

create index if not exists idx_calendar_events_org_tag
  on public.organization_calendar_events(organization_id, tag);

alter table public.organization_calendar_events enable row level security;

drop policy if exists "org_members_select_calendar_events" on public.organization_calendar_events;
create policy "org_members_select_calendar_events"
  on public.organization_calendar_events
  for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "org_members_insert_calendar_events" on public.organization_calendar_events;
create policy "org_members_insert_calendar_events"
  on public.organization_calendar_events
  for insert
  to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "org_members_update_calendar_events" on public.organization_calendar_events;
create policy "org_members_update_calendar_events"
  on public.organization_calendar_events
  for update
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "org_members_delete_calendar_events" on public.organization_calendar_events;
create policy "org_members_delete_calendar_events"
  on public.organization_calendar_events
  for delete
  to authenticated
  using (public.is_org_member(organization_id));

drop trigger if exists trigger_update_calendar_events_timestamp on public.organization_calendar_events;
create trigger trigger_update_calendar_events_timestamp
  before update on public.organization_calendar_events
  for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- MIGRATION 00014: Settings & Notifications
-- ------------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_user_notification_type unique (user_id, notification_type)
);

create index if not exists idx_notif_prefs_user on public.notification_preferences(user_id);
create index if not exists idx_notif_prefs_user_type on public.notification_preferences(user_id, notification_type);

alter table public.notification_preferences enable row level security;

drop policy if exists "Users can view own notification preferences" on public.notification_preferences;
create policy "Users can view own notification preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
create policy "Users can insert own notification preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
create policy "Users can update own notification preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notification preferences" on public.notification_preferences;
create policy "Users can delete own notification preferences"
  on public.notification_preferences for delete
  using (auth.uid() = user_id);

alter table public.profiles
  add column if not exists timezone text default 'UTC',
  add column if not exists first_day_of_week text default 'monday',
  add column if not exists typography text default 'sans';

alter table public.organizations
  add column if not exists logo_url text,
  add column if not exists primary_color text default '#3b82f6',
  add column if not exists accent_color text default '#6366f1',
  add column if not exists default_font text default 'sans';

-- ------------------------------------------------------------------------------
-- MIGRATION 00015: Extended Settings & Audit Trail
-- ------------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  actor_email text,
  action text not null,
  resource_type text not null,
  resource_name text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_org_created on public.audit_logs(organization_id, created_at desc);
create index if not exists idx_audit_logs_action on public.audit_logs(organization_id, action);

alter table public.audit_logs enable row level security;

drop policy if exists "Owners and admins can view audit logs" on public.audit_logs;
create policy "Owners and admins can view audit logs"
  on public.audit_logs for select
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
  );

drop policy if exists "Authenticated users can insert audit logs" on public.audit_logs;
create policy "Authenticated users can insert audit logs"
  on public.audit_logs for insert
  with check (
    auth.uid() = actor_id
    and public.is_org_member(organization_id)
  );

alter table public.profiles
  add column if not exists phone_number text,
  add column if not exists date_format text default 'DD/MM/YYYY',
  add column if not exists time_format text default '24h',
  add column if not exists user_preferences jsonb default '{
    "openLastVisitedPage": true,
    "confirmBeforeDelete": true,
    "compactMode": false,
    "showShortcuts": true,
    "reduceMotion": false,
    "defaultEditorWidth": "standard",
    "defaultPageLayout": "standard",
    "spellCheck": true
  }'::jsonb;

alter table public.organizations
  add column if not exists workspace_settings jsonb default '{
    "defaultNewPageVisibility": "workspace",
    "defaultEditorWidth": "standard",
    "enablePublicSharing": false,
    "enableComments": true,
    "enablePageHistory": true,
    "defaultMemberRole": "member",
    "requireTwoFactor": false,
    "sessionTimeoutMinutes": 10080,
    "allowedEmailDomains": []
  }'::jsonb;

-- ------------------------------------------------------------------------------
-- MIGRATION 00016: Page Authorship, Activity, Versions & Comments
-- ------------------------------------------------------------------------------
alter table if exists public.pages
  add column if not exists last_edited_by uuid references auth.users(id) on delete set null;

update public.pages
set last_edited_by = created_by
where last_edited_by is null and created_by is not null;

create index if not exists idx_pages_last_edited_by
  on public.pages (organization_id, last_edited_by);

create table if not exists public.page_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_page_activity_lookup
  on public.page_activity (organization_id, page_id, created_at desc);

create index if not exists idx_page_activity_actor
  on public.page_activity (organization_id, actor_id);

alter table public.page_activity enable row level security;

drop policy if exists "Users can view page activity for their organization" on public.page_activity;
create policy "Users can view page activity for their organization"
  on public.page_activity
  for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "Users can insert page activity for their organization" on public.page_activity;
create policy "Users can insert page activity for their organization"
  on public.page_activity
  for insert
  to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "Users can delete page activity for their organization" on public.page_activity;
create policy "Users can delete page activity for their organization"
  on public.page_activity
  for delete
  to authenticated
  using (public.is_org_member(organization_id));

create table if not exists public.page_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  version_number integer not null default 1,
  title text not null default 'Untitled',
  content jsonb not null default '[]'::jsonb,
  content_text text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_page_versions_lookup
  on public.page_versions (organization_id, page_id, version_number desc);

alter table public.page_versions enable row level security;

drop policy if exists "Users can view page versions for their organization" on public.page_versions;
create policy "Users can view page versions for their organization"
  on public.page_versions
  for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "Users can insert page versions for their organization" on public.page_versions;
create policy "Users can insert page versions for their organization"
  on public.page_versions
  for insert
  to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "Users can delete page versions for their organization" on public.page_versions;
create policy "Users can delete page versions for their organization"
  on public.page_versions
  for delete
  to authenticated
  using (public.is_org_member(organization_id));

create table if not exists public.page_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  block_id text,
  author_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.page_comments(id) on delete cascade,
  content text not null,
  is_resolved boolean not null default false,
  is_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_page_comments_lookup
  on public.page_comments (organization_id, page_id, created_at desc);

create index if not exists idx_page_comments_author
  on public.page_comments (organization_id, author_id);

alter table public.page_comments enable row level security;

drop policy if exists "Users can view comments in their organization" on public.page_comments;
create policy "Users can view comments in their organization"
  on public.page_comments
  for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "Users can add comments in their organization" on public.page_comments;
create policy "Users can add comments in their organization"
  on public.page_comments
  for insert
  to authenticated
  with check (public.is_org_member(organization_id) and auth.uid() = author_id);

drop policy if exists "Authors and admins can update comments" on public.page_comments;
create policy "Authors and admins can update comments"
  on public.page_comments
  for update
  to authenticated
  using (
    public.is_org_member(organization_id)
    and (auth.uid() = author_id or public.has_org_role(organization_id, array['owner', 'admin']))
  )
  with check (
    public.is_org_member(organization_id)
    and auth.uid() = author_id
  );

drop policy if exists "Authors and admins can delete comments" on public.page_comments;
create policy "Authors and admins can delete comments"
  on public.page_comments
  for delete
  to authenticated
  using (
    public.is_org_member(organization_id)
    and (auth.uid() = author_id or public.has_org_role(organization_id, array['owner', 'admin']))
  );

-- ------------------------------------------------------------------------------
-- MIGRATION 00017: GitHub Integration, Connections & Entity Comments
-- ------------------------------------------------------------------------------
alter table if exists public.company_connections
  drop constraint if exists company_connections_source_type_check;

alter table if exists public.company_connections
  add constraint company_connections_source_type_check check (
    source_type in (
      'page', 'block', 'project', 'task', 'meeting', 'goal', 'person', 'decision', 'document',
      'github_repo', 'github_pr', 'github_issue', 'github_commit', 'github_release'
    )
  );

alter table if exists public.company_connections
  drop constraint if exists company_connections_target_type_check;

alter table if exists public.company_connections
  add constraint company_connections_target_type_check check (
    target_type in (
      'page', 'block', 'project', 'task', 'meeting', 'goal', 'person', 'decision', 'document',
      'github_repo', 'github_pr', 'github_issue', 'github_commit', 'github_release'
    )
  );

alter table if exists public.page_connections
  drop constraint if exists page_connections_target_type_check;

alter table if exists public.page_connections
  add constraint page_connections_target_type_check check (
    target_type in ('project', 'task', 'meeting', 'goal', 'person', 'page', 'decision', 'document', 'file', 'github')
  );

create table if not exists public.entity_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('github_repo', 'github_pr', 'github_issue', 'github_commit', 'github_release', 'external_ref')),
  entity_id text not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.entity_comments(id) on delete cascade,
  content text not null,
  is_resolved boolean not null default false,
  is_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_entity_comments_lookup
  on public.entity_comments (organization_id, entity_type, entity_id, created_at desc);

create index if not exists idx_entity_comments_author
  on public.entity_comments (organization_id, author_id);

alter table public.entity_comments enable row level security;

drop policy if exists "Users can view entity comments in their organization" on public.entity_comments;
create policy "Users can view entity comments in their organization"
  on public.entity_comments
  for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "Users can insert entity comments in their organization" on public.entity_comments;
create policy "Users can insert entity comments in their organization"
  on public.entity_comments
  for insert
  to authenticated
  with check (public.is_org_member(organization_id) and auth.uid() = author_id);

drop policy if exists "Authors and admins can update entity comments" on public.entity_comments;
create policy "Authors and admins can update entity comments"
  on public.entity_comments
  for update
  to authenticated
  using (
    public.is_org_member(organization_id)
    and (auth.uid() = author_id or public.has_org_role(organization_id, array['owner', 'admin']))
  )
  with check (
    public.is_org_member(organization_id)
    and auth.uid() = author_id
  );

drop policy if exists "Authors and admins can delete entity comments" on public.entity_comments;
create policy "Authors and admins can delete entity comments"
  on public.entity_comments
  for delete
  to authenticated
  using (
    public.is_org_member(organization_id)
    and (auth.uid() = author_id or public.has_org_role(organization_id, array['owner', 'admin']))
  );

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
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
drop policy if exists "Owners and admins can insert teams" on public.organization_teams;
create policy "Owners and admins can insert teams"
  on public.organization_teams for insert
  to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "Members with team permissions can update teams" on public.organization_teams;
drop policy if exists "Owners and admins can update teams" on public.organization_teams;
create policy "Owners and admins can update teams"
  on public.organization_teams for update
  to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "Members with team permissions can delete teams" on public.organization_teams;
drop policy if exists "Owners and admins can delete teams" on public.organization_teams;
create policy "Owners and admins can delete teams"
  on public.organization_teams for delete
  to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']));

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
drop policy if exists "Owners and admins can manage team memberships" on public.organization_team_members;
create policy "Owners and admins can manage team memberships"
  on public.organization_team_members for insert
  to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "Authorized members can remove team memberships" on public.organization_team_members;
drop policy if exists "Owners and admins can remove team memberships" on public.organization_team_members;
create policy "Owners and admins can remove team memberships"
  on public.organization_team_members for delete
  to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']));

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
drop policy if exists "Owners and admins can insert team permissions" on public.team_permissions;
create policy "Owners and admins can insert team permissions"
  on public.team_permissions for insert
  to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "Authorized members can delete team permissions" on public.team_permissions;
drop policy if exists "Owners and admins can delete team permissions" on public.team_permissions;
create policy "Owners and admins can delete team permissions"
  on public.team_permissions for delete
  to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']));

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
drop policy if exists "Owners and admins can insert permission overrides" on public.member_permission_overrides;
create policy "Owners and admins can insert permission overrides"
  on public.member_permission_overrides for insert
  to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "Authorized members can update permission overrides" on public.member_permission_overrides;
drop policy if exists "Owners and admins can update permission overrides" on public.member_permission_overrides;
create policy "Owners and admins can update permission overrides"
  on public.member_permission_overrides for update
  to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "Authorized members can delete permission overrides" on public.member_permission_overrides;
drop policy if exists "Owners and admins can delete permission overrides" on public.member_permission_overrides;
create policy "Owners and admins can delete permission overrides"
  on public.member_permission_overrides for delete
  to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']));

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
drop policy if exists "Owners and admins can manage resource permissions" on public.resource_permissions;
create policy "Owners and admins can manage resource permissions"
  on public.resource_permissions for insert
  to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "Authorized members can delete resource permissions" on public.resource_permissions;
drop policy if exists "Owners and admins can delete resource permissions" on public.resource_permissions;
create policy "Owners and admins can delete resource permissions"
  on public.resource_permissions for delete
  to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']));

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
