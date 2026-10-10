-- ==============================================================================
-- Company Brain: Settings, Typography, Branding & Notification Preferences
-- Migration: 00014_settings_and_notifications.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. NOTIFICATION PREFERENCES TABLE
-- Stores user-specific channeled notification preferences (In-app, Email)
-- ------------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_user_notification_type unique (user_id, notification_type)
);

create index if not exists idx_notif_prefs_user on public.notification_preferences(user_id);
create index if not exists idx_notif_prefs_user_type on public.notification_preferences(user_id, notification_type);

alter table public.notification_preferences enable row level security;

-- Strict User-Level RLS Policies
drop policy if exists "Users can view own notification preferences" on public.notification_preferences;
create policy "Users can view own notification preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
create policy "Users can insert own notification preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
create policy "Users can update own notification preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notification preferences" on public.notification_preferences;
create policy "Users can delete own notification preferences"
  on public.notification_preferences for delete
  using (auth.uid() = user_id);

-- Updated_at trigger
drop trigger if exists set_notif_prefs_updated_at on public.notification_preferences;
create trigger set_notif_prefs_updated_at
  before update on public.notification_preferences
  for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2. USER PROFILES EXTENSIONS
-- Timezone, First Day of Week, and Typography preferences
-- ------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists timezone text default 'UTC',
  add column if not exists first_day_of_week text default 'monday',
  add column if not exists typography_settings jsonb default '{"baseFontSize":"16px","h1Size":"2rem","h2Size":"1.5rem","h3Size":"1.25rem"}'::jsonb;

-- Add check constraint for first_day_of_week if not already present
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_profiles_first_day_of_week'
  ) then
    alter table public.profiles
      add constraint chk_profiles_first_day_of_week
      check (first_day_of_week in ('monday', 'sunday'));
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 3. ORGANIZATIONS EXTENSIONS
-- Branding & outbound transactional email dispatch settings
-- ------------------------------------------------------------------------------
alter table public.organizations
  add column if not exists allow_user_email_dispatch boolean default false,
  add column if not exists branding_settings jsonb default '{"senderName":"","customLogoUrl":"","footerText":"","brandColor":"#2563eb"}'::jsonb;
