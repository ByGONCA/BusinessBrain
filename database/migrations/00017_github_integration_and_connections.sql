-- ==============================================================================
-- Company Brain: GitHub Integration, Connections & Entity Comments Layer
-- Migration: 00017_github_integration_and_connections.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXPAND COMPANY CONNECTIONS SOURCE & TARGET TYPES
-- Allow GitHub objects (Repositories, PRs, Issues, Commits, Releases) in Company Brain graph.
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

-- ------------------------------------------------------------------------------
-- 2. EXPAND PAGE CONNECTIONS TARGET TYPE
-- Allow 'github' target_type in page_connections for deterministic cross-entity links.
-- ------------------------------------------------------------------------------
alter table if exists public.page_connections
  drop constraint if exists page_connections_target_type_check;

alter table if exists public.page_connections
  add constraint page_connections_target_type_check check (
    target_type in ('project', 'task', 'meeting', 'goal', 'person', 'page', 'decision', 'document', 'file', 'github')
  );

-- ------------------------------------------------------------------------------
-- 3. INTERNAL ENTITY COMMENTS TABLE
-- Collaborative discussion threads on external references (e.g. GitHub PRs, Issues, Commits).
-- These comments remain strictly private within BusinessBrain and are never posted to external APIs.
-- ------------------------------------------------------------------------------
create table if not exists public.entity_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('github_repo', 'github_pr', 'github_issue', 'github_commit', 'github_release', 'external_ref')),
  entity_id text not null,   -- e.g. 'owner/repo#184' or 'owner/repo/commit_sha'
  author_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.entity_comments(id) on delete cascade,
  content text not null,
  is_resolved boolean not null default false,
  is_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for fast tenant retrieval and entity lookup
create index if not exists idx_entity_comments_lookup
  on public.entity_comments (organization_id, entity_type, entity_id, created_at asc);

create index if not exists idx_entity_comments_parent
  on public.entity_comments (parent_id);

-- Updated_at trigger
drop trigger if exists set_entity_comments_updated_at on public.entity_comments;
create trigger set_entity_comments_updated_at
  before update on public.entity_comments
  for each row execute function public.handle_updated_at();

-- Enable RLS
alter table public.entity_comments enable row level security;

-- RLS Policies for entity_comments
create policy "Users can view entity comments in their organization"
  on public.entity_comments
  for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "Users can insert entity comments in their organization"
  on public.entity_comments
  for insert
  to authenticated
  with check (public.is_org_member(organization_id));

create policy "Users can update entity comments in their organization"
  on public.entity_comments
  for update
  to authenticated
  using (
    public.is_org_member(organization_id)
    and author_id = auth.uid()
  )
  with check (
    public.is_org_member(organization_id)
    and author_id = auth.uid()
  );

create policy "Users can delete entity comments in their organization"
  on public.entity_comments
  for delete
  to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      author_id = auth.uid()
      or public.has_org_role(organization_id, array['owner', 'admin'])
    )
  );

-- Notify PostgREST to reload schema cache
notify pgrst, 'reload schema';
