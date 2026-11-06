-- ==============================================================================
-- Company Brain: Universal Dashboard Builder & Multi-Dashboard CAS Persistence
-- Migration: 00044_universal_dashboards.sql
-- ==============================================================================

-- Drop previous function signatures
drop function if exists public.save_dashboard_layout_cas(uuid, text, jsonb, text, boolean);

-- ------------------------------------------------------------------------------
-- 1. FUNCTION: save_dashboard_layout_cas (Updated for Universal Dashboards)
-- Allows canonical ('home', 'finance') and secure custom dashboard slugs ('custom-[id]')
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

  -- 3. Validate dashboard type (alphanumeric, dashes, underscores up to 64 chars)
  if p_dashboard_type is null or p_dashboard_type !~* '^[a-z0-9_-]{1,64}$' then
    return jsonb_build_object(
      'success', false,
      'code', 'INVALID_DASHBOARD',
      'message', 'Invalid dashboard identifier format.'
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

  -- 6. Enforce Compare-And-Swap (CAS) token concurrency match
  if not p_force_overwrite and v_current_updated_at is not null then
    if p_expected_updated_at is null or p_expected_updated_at <> v_current_updated_at then
      return jsonb_build_object(
        'success', false,
        'code', 'STALE_WRITE',
        'message', 'Layout was modified concurrently.',
        'current_updated_at', v_current_updated_at
      );
    end if;
  end if;

  -- 7. Atomic JSONB write
  v_updated_at := clock_timestamp();
  v_updated_prefs := jsonb_set(
    v_current_preferences,
    array['dashboard_layouts', p_org_id::text, p_dashboard_type],
    p_layout,
    true
  );

  update public.profiles
  set 
    user_preferences = v_updated_prefs,
    updated_at = v_updated_at
  where id = v_user_id;

  return jsonb_build_object(
    'success', true,
    'updated_at', to_jsonb(v_updated_at)
  );
end;
$$;

revoke execute on function public.save_dashboard_layout_cas(uuid, text, jsonb, text, boolean) from public;
grant execute on function public.save_dashboard_layout_cas(uuid, text, jsonb, text, boolean) to authenticated;
