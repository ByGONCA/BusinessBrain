-- ==============================================================================
-- KogSync: Sentry Integration OAuth Concurrency, Atomic Leases & Replay Protection
-- Migration: 00046_sentry_integration_oauth_concurrency.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNCTION: acquire_sentry_refresh_lease
-- Acquires an atomic row-level lock on organization_integrations for Sentry token rotation.
-- Prevents concurrent workers from executing competing refresh requests.
-- ------------------------------------------------------------------------------
create or replace function public.acquire_sentry_refresh_lease(
  p_org_id uuid,
  p_worker_id text,
  p_lease_seconds int default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_now timestamptz := clock_timestamp();
  v_lock_until timestamptz;
begin
  -- Lock the row using FOR UPDATE to serialize concurrent workers
  select * into v_row
  from public.organization_integrations
  where organization_id = p_org_id and provider = 'sentry'
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  end if;

  -- 1. Check if another worker already refreshed token (has > 2 minutes lifetime remaining)
  if v_row.token_expires_at is not null and v_row.token_expires_at > v_now + interval '2 minutes' then
    return jsonb_build_object(
      'success', false,
      'code', 'ALREADY_REFRESHED',
      'encrypted_access_token', v_row.encrypted_access_token,
      'encrypted_refresh_token', v_row.encrypted_refresh_token,
      'token_expires_at', v_row.token_expires_at
    );
  end if;

  -- 2. Check if an active lease is currently held by a peer worker (< lease duration)
  if v_row.metadata ? 'refresh_lock_until' then
    v_lock_until := (v_row.metadata->>'refresh_lock_until')::timestamptz;
    if v_lock_until > v_now and (v_row.metadata->>'refresh_lock_worker') != p_worker_id then
      return jsonb_build_object(
        'success', false,
        'code', 'LOCKED_BY_PEER',
        'retry_after_ms', extract(epoch from (v_lock_until - v_now)) * 1000
      );
    end if;
  end if;

  -- 3. Atomically acquire lease
  update public.organization_integrations
  set metadata = jsonb_set(
    jsonb_set(metadata, '{refresh_lock_until}', to_jsonb((v_now + (p_lease_seconds || ' seconds')::interval)::text)),
    '{refresh_lock_worker}', to_jsonb(p_worker_id)
  ),
  updated_at = v_now
  where organization_id = p_org_id and provider = 'sentry';

  return jsonb_build_object(
    'success', true,
    'code', 'LEASE_ACQUIRED',
    'current_encrypted_refresh_token', v_row.encrypted_refresh_token
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 2. FUNCTION: release_sentry_refresh_lease
-- Safely releases the refresh lease owned by the calling worker.
-- A stale worker cannot release a newer lease held by another worker.
-- ------------------------------------------------------------------------------
create or replace function public.release_sentry_refresh_lease(
  p_org_id uuid,
  p_worker_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  update public.organization_integrations
  set metadata = metadata - 'refresh_lock_until' - 'refresh_lock_worker',
      updated_at = v_now
  where organization_id = p_org_id
    and provider = 'sentry'
    and metadata->>'refresh_lock_worker' = p_worker_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. FUNCTION: save_sentry_refreshed_tokens_cas
-- Atomically persists newly rotated tokens with Optimistic Concurrency Control (OCC).
-- Guards against stale workers overwriting newer tokens or releasing newer leases.
-- ------------------------------------------------------------------------------
create or replace function public.save_sentry_refreshed_tokens_cas(
  p_org_id uuid,
  p_worker_id text,
  p_expected_refresh_token text,
  p_new_encrypted_access text,
  p_new_encrypted_refresh text,
  p_token_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_updated int;
begin
  update public.organization_integrations
  set encrypted_access_token = p_new_encrypted_access,
      encrypted_refresh_token = coalesce(p_new_encrypted_refresh, encrypted_refresh_token),
      token_expires_at = p_token_expires_at,
      status = 'connected',
      metadata = metadata - 'refresh_lock_until' - 'refresh_lock_worker',
      updated_at = v_now
  where organization_id = p_org_id
    and provider = 'sentry'
    and (encrypted_refresh_token = p_expected_refresh_token or encrypted_refresh_token is null)
    and metadata->>'refresh_lock_worker' = p_worker_id;

  get diagnostics v_updated = row_count;

  if v_updated > 0 then
    return jsonb_build_object('success', true, 'code', 'SAVED');
  else
    return jsonb_build_object(
      'success', false,
      'code', 'CONCURRENT_CONFLICT',
      'message', 'Failed to save Sentry tokens due to concurrent modification or lease expiration.'
    );
  end if;
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. FUNCTION PERMISSIONS & LEAST-PRIVILEGE HYGIENE
-- Revoke public execution on SECURITY DEFINER functions; grant to authenticated & service_role
-- ------------------------------------------------------------------------------
revoke all on function public.acquire_sentry_refresh_lease(uuid, text, int) from public;
grant execute on function public.acquire_sentry_refresh_lease(uuid, text, int) to authenticated, service_role;

revoke all on function public.release_sentry_refresh_lease(uuid, text) from public;
grant execute on function public.release_sentry_refresh_lease(uuid, text) to authenticated, service_role;

revoke all on function public.save_sentry_refreshed_tokens_cas(uuid, text, text, text, text, timestamptz) from public;
grant execute on function public.save_sentry_refreshed_tokens_cas(uuid, text, text, text, text, timestamptz) to authenticated, service_role;

