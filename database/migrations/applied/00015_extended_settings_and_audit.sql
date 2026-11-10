-- ==============================================================================
-- Company Brain: Extended Settings, Profile Preferences & Audit Trail
-- Migration: 00015_extended_settings_and_audit.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AUDIT LOGS TABLE
-- Organization-scoped security and operational audit trail
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

-- RLS: Owners and admins can view audit logs for their organization
drop policy if exists "Owners and admins can view audit logs" on public.audit_logs;
create policy "Owners and admins can view audit logs"
  on public.audit_logs for select
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
  );

-- RLS: Authenticated users can insert audit logs within their active organization
drop policy if exists "Authenticated users can insert audit logs" on public.audit_logs;
create policy "Authenticated users can insert audit logs"
  on public.audit_logs for insert
  with check (
    auth.uid() = actor_id
    and public.is_org_member(organization_id)
  );

-- ------------------------------------------------------------------------------
-- 2. USER PROFILES EXTENSIONS
-- Phone number, date/time format, and detailed personal preferences
-- ------------------------------------------------------------------------------
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
    "showOutlineByDefault": false,
    "showConnectionsByDefault": false,
    "defaultCalendarView": "month",
    "workingHoursStart": "09:00",
    "workingHoursEnd": "18:00",
    "defaultMeetingDuration": 30
  }'::jsonb;

-- ------------------------------------------------------------------------------
-- 3. ORGANIZATIONS EXTENSIONS
-- Company profile metadata and workspace-wide defaults
-- ------------------------------------------------------------------------------
alter table public.organizations
  add column if not exists logo_url text,
  add column if not exists description text,
  add column if not exists industry text,
  add column if not exists company_size text,
  add column if not exists country text,
  add column if not exists default_timezone text default 'Europe/Lisbon',
  add column if not exists default_language text default 'en',
  add column if not exists default_currency text default 'EUR',
  add column if not exists workspace_defaults jsonb default '{
    "defaultTaskStatus": "todo",
    "defaultTaskPriority": "medium",
    "defaultProjectStatus": "active",
    "defaultMeetingDuration": 30,
    "defaultCalendarBehavior": "prompt",
    "defaultPageIcon": "document",
    "defaultPageLayout": "standard",
    "defaultCalendarView": "month"
  }'::jsonb;

-- ------------------------------------------------------------------------------
-- 4. ORGANIZATION MEMBERS ROLE EXTENSION
-- Ensure 'guest' role is permitted alongside owner, admin, member
-- ------------------------------------------------------------------------------
alter table public.organization_members
  drop constraint if exists organization_members_role_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organization_members_role_check'
  ) then
    alter table public.organization_members
      add constraint organization_members_role_check
      check (role in ('owner', 'admin', 'member', 'guest'));
  end if;
end $$;
