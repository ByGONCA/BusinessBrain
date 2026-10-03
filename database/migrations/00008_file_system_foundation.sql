-- ==============================================================================
-- Company Brain: File System & External File Integration Foundation
-- Migration: 00008_file_system_foundation.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ORGANIZATION FILES TABLE
-- Supports internal Company Brain storage and external cloud references
-- (Google Drive, OneDrive, SharePoint, Dropbox).
-- External files are references only; no content duplication.
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
  storage_path text, -- Folder path in Supabase Storage bucket for company_brain
  external_file_id text, -- ID in Google Drive / OneDrive
  external_parent_id text, -- Parent folder ID in external provider
  external_url text, -- Web link / webViewLink to file
  status text not null default 'ready' check (
    status in ('pending_upload', 'ready', 'unavailable', 'error', 'archived')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Indexes for fast tenant retrieval, provider filtering, and external lookups
create index if not exists idx_org_files_org on public.organization_files(organization_id);
create index if not exists idx_org_files_org_provider on public.organization_files(organization_id, storage_provider);
create index if not exists idx_org_files_org_status on public.organization_files(organization_id, status);
create index if not exists idx_org_files_external on public.organization_files(organization_id, storage_provider, external_file_id);
create index if not exists idx_org_files_deleted on public.organization_files(organization_id, deleted_at);

-- Updated_at trigger
drop trigger if exists set_org_files_updated_at on public.organization_files;
create trigger set_org_files_updated_at
  before update on public.organization_files
  for each row execute function public.handle_updated_at();

-- Enable RLS
alter table public.organization_files enable row level security;

-- RLS Policies for organization_files
drop policy if exists "Members can view files of their organization" on public.organization_files;
create policy "Members can view files of their organization"
  on public.organization_files for select
  using (public.is_org_member(organization_id) and deleted_at is null);

drop policy if exists "Members can insert files into their organization" on public.organization_files;
create policy "Members can insert files into their organization"
  on public.organization_files for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can update files in their organization" on public.organization_files;
create policy "Members can update files in their organization"
  on public.organization_files for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can delete files in their organization" on public.organization_files;
create policy "Members can delete files in their organization"
  on public.organization_files for delete
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or uploaded_by = auth.uid()
  );

-- ------------------------------------------------------------------------------
-- 2. PAGE FILES (PAGE ↔ FILE RELATIONSHIPS)
-- Many-to-many relationship attaching files to pages without duplicating records.
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

-- Enable RLS
alter table public.page_files enable row level security;

-- RLS Policies for page_files
drop policy if exists "Members can view page files of their organization" on public.page_files;
create policy "Members can view page files of their organization"
  on public.page_files for select
  using (public.is_org_member(organization_id));

drop policy if exists "Members can insert page files into their organization" on public.page_files;
create policy "Members can insert page files into their organization"
  on public.page_files for insert
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can update page files in their organization" on public.page_files;
create policy "Members can update page files in their organization"
  on public.page_files for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "Members can delete page files in their organization" on public.page_files;
create policy "Members can delete page files in their organization"
  on public.page_files for delete
  using (public.is_org_member(organization_id));

-- ------------------------------------------------------------------------------
-- 3. EXPAND PAGE CONNECTIONS TARGET TYPE
-- Allow 'file' target_type in page_connections for deterministic cross-entity links.
-- ------------------------------------------------------------------------------
alter table if exists public.page_connections
  drop constraint if exists page_connections_target_type_check;

alter table if exists public.page_connections
  add constraint page_connections_target_type_check check (
    target_type in ('project', 'task', 'meeting', 'goal', 'person', 'page', 'decision', 'document', 'file')
  );

-- ------------------------------------------------------------------------------
-- 4. STORAGE ACCOUNTING RPC
-- Calculates sum of physical bytes used by an organization (company_brain files only).
-- External files (Google Drive, OneDrive) consume 0 Company Brain storage.
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

-- Revoke default public execution and restrict permissions
revoke all on function public.get_organization_storage_bytes(uuid) from public;
grant execute on function public.get_organization_storage_bytes(uuid) to anon, authenticated, service_role, postgres;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
