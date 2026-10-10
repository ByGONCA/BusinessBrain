-- ==============================================================================
-- Company Brain: Consolidated Migrations (00013 to 00017)
-- Safe, idempotent execution for Supabase SQL Editor.
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
