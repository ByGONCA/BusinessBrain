-- ==============================================================================
-- Company Brain: Atomic Compare-And-Swap (CAS) Dashboard Layout Persistence
-- Migration: 00037_dashboard_layout_cas.sql
-- ==============================================================================

-- Drop previous function signature if any exists
drop function if exists public.save_dashboard_layout_cas(uuid, text, jsonb, text);
drop function if exists public.save_dashboard_layout_cas(uuid, text, jsonb, text, boolean);

-- ------------------------------------------------------------------------------
-- 1. FUNCTION: save_dashboard_layout_cas
-- Implements row-level locking (FOR UPDATE) to serialize concurrent modifications
-- on the user's profile and guarantees atomic JSONB path updates.
-- ------------------------------------------------------------------------------
create or replace function public.save_dashboard_layout_cas(
  p_org_id uuid,
  p_dashboard_type text,
  p_layout jsonb,
  p_expected_updated_at text default null,
  p_force_overwrite boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_is_member boolean;
  v_current_preferences jsonb;
  v_current_layout jsonb;
  v_current_updated_at text;
  v_updated_prefs jsonb;
  v_updated_at timestamptz;
begin
  -- 1. Enforce authentication
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object(
      'success', false,
      'code', 'UNAUTHENTICATED',
      'message', 'Authentication required.'
    );
  end if;

  -- 2. Enforce active organization membership independently in database
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = v_user_id
  ) into v_is_member;

  if not v_is_member then
    return jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'message', 'Access denied to organization.'
    );
  end if;

  -- 3. Validate dashboard type (only 'home' or 'finance' authorized)
  if p_dashboard_type not in ('home', 'finance') then
    return jsonb_build_object(
      'success', false,
      'code', 'INVALID_DASHBOARD',
      'message', 'Invalid dashboard type.'
    );
  end if;

  -- 4. Validate layout payload structure (must be object with widgets array)
  if p_layout is null 
     or jsonb_typeof(p_layout) <> 'object' 
     or not (p_layout ? 'widgets') 
     or jsonb_typeof(p_layout->'widgets') <> 'array' then
    return jsonb_build_object(
      'success', false,
      'code', 'INVALID_LAYOUT',
      'message', 'Malformed layout object.'
    );
  end if;

  -- 5. Serialize concurrent writes with row-level locking (FOR UPDATE)
  -- This blocks any parallel call for this user's profile until the current transaction commits.
  select user_preferences
  into v_current_preferences
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'PROFILE_NOT_FOUND',
      'message', 'User profile not found.'
    );
  end if;

  v_current_preferences := coalesce(v_current_preferences, '{}'::jsonb);
  v_current_layout := v_current_preferences->'dashboard_layouts'->p_org_id::text->p_dashboard_type;
  v_current_updated_at := v_current_layout->>'updatedAt';

  -- 6. Atomic Concurrency Check (Compare-And-Swap)
  if not coalesce(p_force_overwrite, false) then
    -- Stale save check: expected timestamp mismatch
    if p_expected_updated_at is not null and v_current_updated_at is not null and v_current_updated_at <> p_expected_updated_at then
      return jsonb_build_object(
        'success', false,
        'code', 'STALE_WRITE',
        'message', 'Dashboard layout was modified in another session.',
        'current_updated_at', v_current_updated_at
      );
    end if;

    -- First-time save collision: client expected empty layout, but one was saved concurrently
    if p_expected_updated_at is null and v_current_updated_at is not null then
      return jsonb_build_object(
        'success', false,
        'code', 'STALE_WRITE',
        'message', 'A dashboard layout was already initialized in another session.',
        'current_updated_at', v_current_updated_at
      );
    end if;
  end if;

  -- 7. Safe JSONB Path Initialization (prevents jsonb_set failure on absent intermediate keys)
  v_updated_prefs := v_current_preferences;
  if not (v_updated_prefs ? 'dashboard_layouts') or jsonb_typeof(v_updated_prefs->'dashboard_layouts') <> 'object' then
    v_updated_prefs := jsonb_set(v_updated_prefs, '{dashboard_layouts}', '{}'::jsonb, true);
  end if;

  if not (v_updated_prefs->'dashboard_layouts' ? p_org_id::text) or jsonb_typeof(v_updated_prefs->'dashboard_layouts'->p_org_id::text) <> 'object' then
    v_updated_prefs := jsonb_set(v_updated_prefs, array['dashboard_layouts', p_org_id::text], '{}'::jsonb, true);
  end if;

  v_updated_prefs := jsonb_set(v_updated_prefs, array['dashboard_layouts', p_org_id::text, p_dashboard_type], p_layout, true);

  -- 8. Atomic Update while holding row lock
  update public.profiles
  set user_preferences = v_updated_prefs,
      updated_at = clock_timestamp()
  where id = v_user_id
  returning updated_at into v_updated_at;

  return jsonb_build_object(
    'success', true,
    'updated_at', to_char(v_updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 2. SECURITY PRIVILEGES
-- Revoke from PUBLIC and anon; grant strictly to authenticated users and service_role.
-- ------------------------------------------------------------------------------
revoke all on function public.save_dashboard_layout_cas(uuid, text, jsonb, text, boolean) from public, anon;
grant execute on function public.save_dashboard_layout_cas(uuid, text, jsonb, text, boolean) to authenticated, service_role, postgres;

-- ------------------------------------------------------------------------------
-- 3. RELOAD POSTGREST SCHEMA CACHE
-- ------------------------------------------------------------------------------
notify pgrst, 'reload schema';
