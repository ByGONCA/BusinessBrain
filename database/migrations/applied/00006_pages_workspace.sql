-- ==============================================================================
-- Company Brain: Pages & Notion-like Workspace System
-- Migration: 00006_pages_workspace.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PAGES TABLE
-- Stores hierarchical documents for an organization.
-- Content is stored as a structured jsonb array of EditorBlock objects.
-- content_text is an extracted plain text representation for fast text search.
-- ------------------------------------------------------------------------------
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_page_id uuid references public.pages(id) on delete cascade,
  title text not null default 'Untitled',
  icon text not null default '📄',
  content jsonb not null default '[]'::jsonb,
  content_text text not null default '',
  position double precision not null default 0,
  is_favorite boolean not null default false,
  favorite_position double precision not null default 0,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure columns exist if table was already created
alter table if exists public.pages
  add column if not exists is_favorite boolean not null default false,
  add column if not exists favorite_position double precision not null default 0;

-- ------------------------------------------------------------------------------
-- 2. INDEXES
-- Optimize tenant-scoped tree traversals, archived status, favorites, and ordering.
-- ------------------------------------------------------------------------------
create index if not exists idx_pages_org_archived_pos
  on public.pages (organization_id, is_archived, position);

create index if not exists idx_pages_favorites
  on public.pages (organization_id, is_favorite, favorite_position);

create index if not exists idx_pages_parent_page_id
  on public.pages (parent_page_id);

create index if not exists idx_pages_created_by
  on public.pages (created_by);

-- Full-text search index for fast organization-scoped search
create index if not exists idx_pages_search
  on public.pages using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content_text, '')));

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS)
-- Enforce database-level multi-tenant isolation via is_org_member.
-- ------------------------------------------------------------------------------
alter table public.pages enable row level security;

-- SELECT policy: members can only view pages of their active organization
drop policy if exists "Members can view active organization pages" on public.pages;
create policy "Members can view active organization pages"
  on public.pages for select
  using (public.is_org_member(organization_id));

-- INSERT policy: members can create pages within their organization
drop policy if exists "Members can create pages in their organization" on public.pages;
create policy "Members can create pages in their organization"
  on public.pages for insert
  with check (
    public.is_org_member(organization_id)
    and (created_by is null or created_by = auth.uid())
  );

-- UPDATE policy: members can update pages within their organization
drop policy if exists "Members can update pages in their organization" on public.pages;
create policy "Members can update pages in their organization"
  on public.pages for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- DELETE policy: members can delete pages within their organization
drop policy if exists "Members can delete pages in their organization" on public.pages;
create policy "Members can delete pages in their organization"
  on public.pages for delete
  using (public.is_org_member(organization_id));
