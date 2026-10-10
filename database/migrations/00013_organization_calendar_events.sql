-- ==============================================================================
-- Migration: 00013_organization_calendar_events.sql
-- Description: Multi-tenant calendar events table with strict RLS and tag filtering
-- ==============================================================================

create table if not exists public.organization_calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  all_day boolean default false,
  tag text default 'Work',
  color text default 'blue',
  location text,
  meeting_link text,
  attendees text[] default '{}',
  source text default 'internal',
  external_event_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for performant range queries and tenant filtering
create index if not exists idx_calendar_events_org_start
  on public.organization_calendar_events(organization_id, start_time);

create index if not exists idx_calendar_events_org_tag
  on public.organization_calendar_events(organization_id, tag);

-- Enable Row Level Security (RLS)
alter table public.organization_calendar_events enable row level security;

-- Strict Multi-Tenant Policies scoped by is_org_member(organization_id)
create policy "org_members_select_calendar_events"
  on public.organization_calendar_events
  for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "org_members_insert_calendar_events"
  on public.organization_calendar_events
  for insert
  to authenticated
  with check (public.is_org_member(organization_id));

create policy "org_members_update_calendar_events"
  on public.organization_calendar_events
  for update
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "org_members_delete_calendar_events"
  on public.organization_calendar_events
  for delete
  to authenticated
  using (public.is_org_member(organization_id));

-- Trigger to keep updated_at accurate
create or replace function public.update_calendar_events_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trigger_update_calendar_events_timestamp on public.organization_calendar_events;
create trigger trigger_update_calendar_events_timestamp
  before update on public.organization_calendar_events
  for each row execute function public.update_calendar_events_updated_at();
