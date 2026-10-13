-- ==============================================================================
-- BusinessBrain: Self-Healing Profile Backfill & Consistency Synchronization
-- Migration: 00024_sync_missing_profiles.sql
-- Description:
--   1. Recovers/synchronizes missing profile for user '8f58fa26-e2cd-453f-a04a-5c379d1614cf'
--      (member '2407ac1e-4a24-43d3-a92c-2678a7397f72', organization 'f3f13c7f-6573-438a-9430-29197ba7399f')
--      directly from auth.users using real authentication metadata.
--   2. Performs universal, idempotent backfill for any organization_members without
--      matching public.profiles rows, preventing unlinked member anomalies.
--   3. Preserves all organization roles (Owner), team memberships, and RLS policies.
-- ==============================================================================

-- 1. Recover/Sync specific member profile if missing
insert into public.profiles (
  id,
  email,
  full_name,
  avatar_url,
  marketing_consent,
  marketing_consent_at,
  created_at,
  updated_at
)
select
  u.id,
  u.email,
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)),
  coalesce(u.raw_user_meta_data->>'avatar_url', ''),
  coalesce((u.raw_user_meta_data->>'marketing_consent')::boolean, false),
  case when (u.raw_user_meta_data->>'marketing_consent')::boolean = true then now() else null end,
  coalesce(u.created_at, now()),
  now()
from auth.users u
where u.id = '8f58fa26-e2cd-453f-a04a-5c379d1614cf'
on conflict (id) do update
set
  email = excluded.email,
  full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
  avatar_url = coalesce(nullif(excluded.avatar_url, ''), public.profiles.avatar_url),
  updated_at = now();

-- 2. Universal backfill for any active organization members missing from public.profiles
insert into public.profiles (
  id,
  email,
  full_name,
  avatar_url,
  created_at,
  updated_at
)
select
  u.id,
  u.email,
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)),
  coalesce(u.raw_user_meta_data->>'avatar_url', ''),
  coalesce(u.created_at, now()),
  now()
from auth.users u
join public.organization_members om on om.user_id = u.id
where not exists (
  select 1 from public.profiles p where p.id = u.id
)
on conflict (id) do nothing;

-- 3. Verify that the owner role is preserved and intact
do $$
declare
  v_role text;
begin
  select role into v_role
  from public.organization_members
  where id = '2407ac1e-4a24-43d3-a92c-2678a7397f72';

  if v_role is distinct from 'owner' then
    raise notice 'Member % has role %', '2407ac1e-4a24-43d3-a92c-2678a7397f72', v_role;
  else
    raise notice 'Verified: Member % is confirmed as owner', '2407ac1e-4a24-43d3-a92c-2678a7397f72';
  end if;
end $$;
