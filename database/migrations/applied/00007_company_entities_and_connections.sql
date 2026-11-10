-- ==============================================================================
-- Company Brain: Company Entities and Page Connections Layer
-- Migration: 00007_company_entities_and_connections.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. COMPANY ENTITIES TABLE
-- Lightweight multi-tenant representation of company entities (Decisions, Tasks,
-- Projects, Meetings, Goals, People, Documents) before full individual domain tables.
-- ------------------------------------------------------------------------------
create table if not exists public.company_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('project', 'task', 'meeting', 'goal', 'person', 'decision', 'document')),
  title text not null,
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for fast tenant retrieval and type filtering
create index if not exists idx_company_entities_org_type 
  on public.company_entities(organization_id, type);

create index if not exists idx_company_entities_created_by 
  on public.company_entities(created_by);

-- Updated_at trigger
drop trigger if exists set_company_entities_updated_at on public.company_entities;
create trigger set_company_entities_updated_at
  before update on public.company_entities
  for each row execute function public.handle_updated_at();

-- Enable RLS
alter table public.company_entities enable row level security;

-- RLS Policies for company_entities
create policy "Users can view entities belonging to their organization"
  on public.company_entities for select
  using (public.is_org_member(organization_id));

create policy "Users can insert entities into their organization"
  on public.company_entities for insert
  with check (public.is_org_member(organization_id));

create policy "Users can update entities in their organization"
  on public.company_entities for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Users can delete entities in their organization"
  on public.company_entities for delete
  using (public.is_org_member(organization_id));


-- ------------------------------------------------------------------------------
-- 2. PAGE CONNECTIONS TABLE
-- Relational link connecting a page or a specific block to an entity.
-- Avoids duplicate text and establishes a clean graph relation.
-- ------------------------------------------------------------------------------
create table if not exists public.page_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  source_type text not null check (source_type in ('page', 'block')),
  source_id text not null, -- page UUID or block UUID string
  target_type text not null check (target_type in ('project', 'task', 'meeting', 'goal', 'person', 'page', 'decision', 'document')),
  target_id uuid not null,
  target_title text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_page_block_connection unique (organization_id, page_id, source_id, target_type, target_id)
);

-- Indexes for performance
create index if not exists idx_page_connections_page 
  on public.page_connections(page_id);

create index if not exists idx_page_connections_source 
  on public.page_connections(organization_id, page_id, source_id);

create index if not exists idx_page_connections_target 
  on public.page_connections(organization_id, target_type, target_id);

-- Updated_at trigger
drop trigger if exists set_page_connections_updated_at on public.page_connections;
create trigger set_page_connections_updated_at
  before update on public.page_connections
  for each row execute function public.handle_updated_at();

-- Enable RLS
alter table public.page_connections enable row level security;

-- RLS Policies for page_connections
create policy "Users can view connections belonging to their organization"
  on public.page_connections for select
  using (public.is_org_member(organization_id));

create policy "Users can insert connections into their organization"
  on public.page_connections for insert
  with check (public.is_org_member(organization_id));

create policy "Users can update connections in their organization"
  on public.page_connections for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Users can delete connections in their organization"
  on public.page_connections for delete
  using (public.is_org_member(organization_id));
