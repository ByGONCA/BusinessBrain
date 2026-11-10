-- ==============================================================================
-- Company Brain: Canonical Company Connections Layer
-- Migration: 00008_company_connections.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CANONICAL COMPANY CONNECTIONS TABLE
-- A directed, typed relationship connecting any two objects within an organization
-- (Pages, Projects, Tasks, Meetings, Goals, People, Decisions, Documents).
-- ------------------------------------------------------------------------------
create table if not exists public.company_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null check (source_type in ('page', 'block', 'project', 'task', 'meeting', 'goal', 'person', 'decision', 'document')),
  source_id text not null, -- UUID or block UUID string
  source_title text not null default '',
  target_type text not null check (target_type in ('page', 'block', 'project', 'task', 'meeting', 'goal', 'person', 'decision', 'document')),
  target_id text not null, -- UUID or block UUID string
  target_title text not null default '',
  relationship_type text not null default 'related_to' check (relationship_type in (
    'related_to',
    'part_of',
    'created_from',
    'depends_on',
    'blocks',
    'decided_in',
    'discussed_in',
    'assigned_to',
    'owned_by',
    'supports',
    'contradicts',
    'replaces',
    'derived_from'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_company_connection unique (organization_id, source_type, source_id, target_type, target_id, relationship_type)
);

-- Indexes for ultra-fast graph traversal and incoming/outgoing lookup
create index if not exists idx_company_connections_org_source 
  on public.company_connections(organization_id, source_id);

create index if not exists idx_company_connections_org_target 
  on public.company_connections(organization_id, target_id);

create index if not exists idx_company_connections_rel 
  on public.company_connections(organization_id, relationship_type);

create index if not exists idx_company_connections_created_by 
  on public.company_connections(created_by);

-- Updated_at trigger
drop trigger if exists set_company_connections_updated_at on public.company_connections;
create trigger set_company_connections_updated_at
  before update on public.company_connections
  for each row execute function public.handle_updated_at();

-- Enable RLS
alter table public.company_connections enable row level security;

-- Strict organization-scoped RLS policies
create policy "Users can view connections belonging to their organization"
  on public.company_connections for select
  using (public.is_org_member(organization_id));

create policy "Users can insert connections into their organization"
  on public.company_connections for insert
  with check (public.is_org_member(organization_id));

create policy "Users can update connections in their organization"
  on public.company_connections for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Users can delete connections in their organization"
  on public.company_connections for delete
  using (public.is_org_member(organization_id));

-- ------------------------------------------------------------------------------
-- 2. DATA MIGRATION FROM LEGACY PAGE_CONNECTIONS
-- Safely copy any existing records into company_connections if page_connections exists
-- ------------------------------------------------------------------------------
do $$
begin
  if exists (
    select from information_schema.tables 
    where table_schema = 'public' and table_name = 'page_connections'
  ) then
    insert into public.company_connections (
      id,
      organization_id,
      source_type,
      source_id,
      source_title,
      target_type,
      target_id,
      target_title,
      relationship_type,
      metadata,
      created_by,
      created_at,
      updated_at
    )
    select
      pc.id,
      pc.organization_id,
      pc.source_type,
      pc.source_id,
      coalesce(pc.metadata->>'source_title', 'Page'),
      pc.target_type,
      pc.target_id::text,
      pc.target_title,
      coalesce(pc.metadata->>'relationship_type', 'related_to'),
      pc.metadata,
      pc.created_by,
      pc.created_at,
      pc.updated_at
    from public.page_connections pc
    on conflict (organization_id, source_type, source_id, target_type, target_id, relationship_type) do nothing;
  end if;
end $$;
