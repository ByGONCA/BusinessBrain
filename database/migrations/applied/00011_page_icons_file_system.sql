-- ==============================================================================
-- Company Brain: Page Icons & File System Tenant Isolation
-- Migration: 00011_page_icons_file_system.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD icon_file_id COLUMN TO PAGES
-- Connects a page directly to an organization-scoped file in organization_files.
-- When the file is deleted, the page icon reverts gracefully to null.
-- ------------------------------------------------------------------------------
alter table public.pages 
  add column if not exists icon_file_id uuid references public.organization_files(id) on delete set null;

-- Index for rapid foreign key resolution and joins
create index if not exists idx_pages_icon_file_id 
  on public.pages(icon_file_id);

-- ------------------------------------------------------------------------------
-- 2. CROSS-TENANT ISOLATION TRIGGER FOR PAGE ICONS
-- Ensures that a page can NEVER reference an icon_file_id belonging to
-- another organization, preventing cross-tenant information leakage.
-- ------------------------------------------------------------------------------
create or replace function public.check_page_icon_tenant_isolation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file_org_id uuid;
begin
  if new.icon_file_id is not null then
    select organization_id into v_file_org_id
    from public.organization_files
    where id = new.icon_file_id;

    if v_file_org_id is null or v_file_org_id <> new.organization_id then
      raise exception 'Cross-tenant violation: icon file does not belong to the same organization.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_page_icon_tenant_isolation on public.pages;
create trigger trg_check_page_icon_tenant_isolation
  before insert or update of icon_file_id, organization_id on public.pages
  for each row
  execute function public.check_page_icon_tenant_isolation();

-- ------------------------------------------------------------------------------
-- 3. RELOAD POSTGREST SCHEMA CACHE
-- ------------------------------------------------------------------------------
notify pgrst, 'reload schema';
