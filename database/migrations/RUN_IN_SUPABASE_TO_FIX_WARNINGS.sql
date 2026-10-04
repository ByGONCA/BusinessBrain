-- ==============================================================================
-- Company Brain: Missing Tables Setup (Page Connections & File System)
-- File: database/migrations/RUN_IN_SUPABASE_TO_FIX_WARNINGS.sql
-- 
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jjalqvgaxzajsyccbjch/sql
-- 
-- This creates the missing tables:
-- 1. public.company_entities
-- 2. public.page_connections
-- 3. public.organization_files
-- 4. public.page_files
-- 5. public.get_organization_storage_bytes RPC
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. COMPANY ENTITIES TABLE
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

create index if not exists idx_company_entities_org_type 
  on public.company_entities(organization_id, type);

create index if not exists idx_company_entities_created_by 
  on public.company_entities(created_by);

drop trigger if exists set_company_entities_updated_at on public.company_entities;
create trigger set_company_entities_updated_at
  before update on public.company_entities
  for each row execute function public.handle_updated_at();

alter table public.company_entities enable row level security;

drop policy if exists "Users can view entities belonging to their organization" on public.company_entities;
create policy "Users can view entities belonging to their organization"
  on public.company_entities for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "Users can insert entities into their organization" on public.company_entities;
create policy "Users can insert entities into their organization"
  on public.company_entities for insert
  to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "Users can update entities in their organization" on public.company_entities;
create policy "Users can update entities in their organization"
  on public.company_entities for update
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Users can delete entities in their organization" on public.company_entities;
create policy "Users can delete entities in their organization"
  on public.company_entities for delete
  to authenticated
  using (public.is_org_member(organization_id));

-- ------------------------------------------------------------------------------
-- 2. PAGE CONNECTIONS TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.page_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  source_type text not null check (source_type in ('page', 'block')),
  source_id text not null,
  target_type text not null check (target_type in ('project', 'task', 'meeting', 'goal', 'person', 'page', 'decision', 'document', 'file')),
  target_id uuid not null,
  target_title text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_page_block_connection unique (organization_id, page_id, source_id, target_type, target_id)
);

create index if not exists idx_page_connections_page 
  on public.page_connections(page_id);

create index if not exists idx_page_connections_source 
  on public.page_connections(organization_id, page_id, source_id);

create index if not exists idx_page_connections_target 
  on public.page_connections(organization_id, target_type, target_id);

drop trigger if exists set_page_connections_updated_at on public.page_connections;
create trigger set_page_connections_updated_at
  before update on public.page_connections
  for each row execute function public.handle_updated_at();

alter table public.page_connections enable row level security;

drop policy if exists "Users can view connections belonging to their organization" on public.page_connections;
create policy "Users can view connections belonging to their organization"
  on public.page_connections for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "Users can insert connections into their organization" on public.page_connections;
create policy "Users can insert connections into their organization"
  on public.page_connections for insert
  to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "Users can update connections in their organization" on public.page_connections;
create policy "Users can update connections in their organization"
  on public.page_connections for update
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Users can delete connections in their organization" on public.page_connections;
create policy "Users can delete connections in their organization"
  on public.page_connections for delete
  to authenticated
  using (public.is_org_member(organization_id));

-- ------------------------------------------------------------------------------
-- 3. ORGANIZATION FILES TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.organization_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  name text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  storage_provider text not null check (
    storage_provider in (
      'company_brain',
      'google_drive',
      'microsoft_onedrive',
      'microsoft_sharepoint',
      'dropbox',
      'other_future_provider'
    )
  ),
  storage_path text,
  external_file_id text,
  external_parent_id text,
  external_url text,
  status text not null default 'ready' check (
    status in ('pending_upload', 'ready', 'unavailable', 'error', 'archived')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_org_files_org on public.organization_files(organization_id);
create index if not exists idx_org_files_org_provider on public.organization_files(organization_id, storage_provider);
create index if not exists idx_org_files_org_status on public.organization_files(organization_id, status);
create index if not exists idx_org_files_external on public.organization_files(organization_id, storage_provider, external_file_id);
create index if not exists idx_org_files_deleted on public.organization_files(organization_id, deleted_at);

drop trigger if exists set_org_files_updated_at on public.organization_files;
create trigger set_org_files_updated_at
  before update on public.organization_files
  for each row execute function public.handle_updated_at();

alter table public.organization_files enable row level security;

drop policy if exists "Members can view files of their organization" on public.organization_files;
create policy "Members can view files of their organization"
  on public.organization_files for select
  to authenticated
  using (public.is_org_member(organization_id) and deleted_at is null);

drop policy if exists "Members can insert files into their organization" on public.organization_files;
create policy "Members can insert files into their organization"
  on public.organization_files for insert
  to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can update files in their organization" on public.organization_files;
create policy "Members can update files in their organization"
  on public.organization_files for update
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can delete files in their organization" on public.organization_files;
create policy "Members can delete files in their organization"
  on public.organization_files for delete
  to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or uploaded_by = auth.uid()
  );

-- ------------------------------------------------------------------------------
-- 4. PAGE FILES TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.page_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  file_id uuid not null references public.organization_files(id) on delete cascade,
  position double precision not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint uq_page_file unique (organization_id, page_id, file_id)
);

create index if not exists idx_page_files_page on public.page_files(page_id);
create index if not exists idx_page_files_file on public.page_files(file_id);
create index if not exists idx_page_files_org on public.page_files(organization_id);

alter table public.page_files enable row level security;

drop policy if exists "Members can view page files of their organization" on public.page_files;
create policy "Members can view page files of their organization"
  on public.page_files for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "Members can insert page files into their organization" on public.page_files;
create policy "Members can insert page files into their organization"
  on public.page_files for insert
  to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can update page files in their organization" on public.page_files;
create policy "Members can update page files in their organization"
  on public.page_files for update
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can delete page files in their organization" on public.page_files;
create policy "Members can delete page files in their organization"
  on public.page_files for delete
  to authenticated
  using (public.is_org_member(organization_id));

-- ------------------------------------------------------------------------------
-- 5. STORAGE ACCOUNTING RPC
-- ------------------------------------------------------------------------------
create or replace function public.get_organization_storage_bytes(p_org_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(size_bytes), 0)::bigint
  from public.organization_files
  where organization_id = p_org_id
    and storage_provider = 'company_brain'
    and deleted_at is null;
$$;

revoke all on function public.get_organization_storage_bytes(uuid) from public;
grant execute on function public.get_organization_storage_bytes(uuid) to authenticated, service_role, postgres;

-- ------------------------------------------------------------------------------
-- 6. RELOAD SCHEMA CACHE
-- ------------------------------------------------------------------------------
notify pgrst, 'reload schema';
