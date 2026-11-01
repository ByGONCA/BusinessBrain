-- ==============================================================================
-- Company Brain: Entity Activity, Audit Trail & History
-- Migration: 00042_entity_activity_history.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENTITY ACTIVITY TABLE
-- Chronological audit trail of human & system actions on company entities
-- (Goals, Decisions, Tasks, Projects, Meetings, etc.).
-- ------------------------------------------------------------------------------
create table if not exists public.entity_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid not null references public.company_entities(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  action text not null, -- 'entity_created', 'status_changed', 'priority_changed', 'due_date_changed', 'assignee_changed', 'content_updated', 'details_updated', 'entity_deleted'
  changes jsonb not null default '{}'::jsonb, -- e.g. { "status": { "old": "todo", "new": "in_progress" } }
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes for lightning-fast retrieval per entity and organization
create index if not exists idx_entity_activity_lookup
  on public.entity_activity (organization_id, entity_id, created_at desc);

create index if not exists idx_entity_activity_actor
  on public.entity_activity (organization_id, actor_id);

-- Enable Row Level Security
alter table public.entity_activity enable row level security;

-- Force RLS to prevent any unintended bypass
alter table public.entity_activity force row level security;

-- Strict multi-tenant isolation: any authenticated organization member can view activity for entities in their organization
drop policy if exists "Users can view entity activity for their organization" on public.entity_activity;
create policy "Users can view entity activity for their organization"
  on public.entity_activity
  for select
  to authenticated
  using (public.is_org_member(organization_id));

-- Strict insert policy: actor_id MUST match auth.uid() exactly to prevent forgery via direct PostgREST API
drop policy if exists "Users can insert entity activity for their organization" on public.entity_activity;
create policy "Users can insert entity activity for their organization"
  on public.entity_activity
  for insert
  to authenticated
  with check (
    auth.uid() = actor_id
    and public.is_org_member(organization_id)
  );

-- Immutability: Activity logs cannot be tampered with or deleted by clients
revoke update, delete on public.entity_activity from authenticated, anon;
