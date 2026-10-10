-- ==============================================================================
-- Company Brain: Page Authorship, Activity, Versions & Comments
-- Migration: 00016_page_authorship_and_activity.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND PAGES TABLE WITH LAST_EDITED_BY
-- Tracks who last updated the page content or metadata.
-- ------------------------------------------------------------------------------
alter table if exists public.pages
  add column if not exists last_edited_by uuid references auth.users(id) on delete set null;

-- Backfill last_edited_by with created_by for existing rows
update public.pages
set last_edited_by = created_by
where last_edited_by is null and created_by is not null;

create index if not exists idx_pages_last_edited_by
  on public.pages (organization_id, last_edited_by);

-- ------------------------------------------------------------------------------
-- 2. PAGE ACTIVITY TABLE
-- Chronological audit trail of meaningful human actions on pages.
-- ------------------------------------------------------------------------------
create table if not exists public.page_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null, -- 'page_created', 'page_renamed', 'content_edited', 'comment_added', 'comment_resolved', 'page_moved', 'connection_added', 'file_added', 'file_removed', 'version_restored'
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_page_activity_lookup
  on public.page_activity (organization_id, page_id, created_at desc);

create index if not exists idx_page_activity_actor
  on public.page_activity (organization_id, actor_id);

alter table public.page_activity enable row level security;

-- Strict multi-tenant isolation via is_org_member
create policy "Users can view page activity for their organization"
  on public.page_activity
  for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "Users can insert page activity for their organization"
  on public.page_activity
  for insert
  to authenticated
  with check (public.is_org_member(organization_id));

create policy "Users can delete page activity for their organization"
  on public.page_activity
  for delete
  to authenticated
  using (public.is_org_member(organization_id));

-- ------------------------------------------------------------------------------
-- 3. PAGE VERSIONS TABLE
-- Stores point-in-time snapshots of page content for history and restoration.
-- ------------------------------------------------------------------------------
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

create policy "Users can view page versions for their organization"
  on public.page_versions
  for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "Users can insert page versions for their organization"
  on public.page_versions
  for insert
  to authenticated
  with check (public.is_org_member(organization_id));

create policy "Users can delete page versions for their organization"
  on public.page_versions
  for delete
  to authenticated
  using (public.is_org_member(organization_id));

-- ------------------------------------------------------------------------------
-- 4. PAGE COMMENTS TABLE
-- Collaborative inline and page comments with authorship and resolution status.
-- ------------------------------------------------------------------------------
create table if not exists public.page_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  is_resolved boolean not null default false,
  is_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_page_comments_lookup
  on public.page_comments (organization_id, page_id, created_at asc);

alter table public.page_comments enable row level security;

create policy "Users can view comments for their organization"
  on public.page_comments
  for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "Users can insert comments for their organization"
  on public.page_comments
  for insert
  to authenticated
  with check (public.is_org_member(organization_id));

create policy "Users can update comments for their organization"
  on public.page_comments
  for update
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Users can delete comments for their organization"
  on public.page_comments
  for delete
  to authenticated
  using (public.is_org_member(organization_id));
