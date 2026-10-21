-- ==============================================================================
-- Company Brain: Onboarding Metadata & Interactive Guided Tour Tracking
-- Migration: 00031_onboarding_and_tour_tracking.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND ORGANIZATIONS TABLE
-- Stores company industry, team size, and onboarding preferences
-- ------------------------------------------------------------------------------
alter table public.organizations
  add column if not exists industry text,
  add column if not exists team_size text,
  add column if not exists onboarding_metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_organizations_industry on public.organizations(industry);

-- ------------------------------------------------------------------------------
-- 2. EXTEND PROFILES TABLE
-- Tracks user onboarding completion, interactive tour progress, and checklist state
-- ------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists tour_completed boolean not null default false,
  add column if not exists tour_completed_at timestamptz,
  add column if not exists tour_step integer not null default 0,
  add column if not exists checklist_state jsonb not null default '{
    "page_created": false,
    "member_invited": false,
    "connection_explored": false,
    "settings_configured": false,
    "dismissed": false
  }'::jsonb;

create index if not exists idx_profiles_tour_completed on public.profiles(tour_completed);

-- ------------------------------------------------------------------------------
-- 3. COMMENTS & AUDIT
-- ------------------------------------------------------------------------------
comment on column public.organizations.industry is 'Industry or business domain selected during onboarding';
comment on column public.organizations.team_size is 'Estimated team size category (e.g., 1, 2-10, 11-50, 51-200, 201+)';
comment on column public.organizations.onboarding_metadata is 'Flexible metadata including primary objectives and acquisition attribution';
comment on column public.profiles.tour_completed is 'Whether the user completed or dismissed the interactive guided tour';
comment on column public.profiles.tour_step is 'Last completed step in the in-app interactive tour';
comment on column public.profiles.checklist_state is 'Interactive first-use checklist progress';
