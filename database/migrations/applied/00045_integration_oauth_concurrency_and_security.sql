-- ==============================================================================
-- KogSync: Integration OAuth Concurrency, Atomic Leases & Replay Protection
-- Migration: 00045_integration_oauth_concurrency_and_security.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE: public.oauth_state_nonces
-- High-performance atomic nonce ledger to prevent OAuth callback replays.
-- Stores ZERO business data; only single-use cryptographic tokens.
-- ------------------------------------------------------------------------------
create table if not exists public.oauth_state_nonces (
  nonce text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_oauth_state_nonces_expires on public.oauth_state_nonces(expires_at);
create index if not exists idx_oauth_state_nonces_org on public.oauth_state_nonces(organization_id);

alter table public.oauth_state_nonces enable row level security;

-- Only service role and SECURITY DEFINER RPCs can manage nonces
drop policy if exists "Deny direct public access to oauth nonces" on public.oauth_state_nonces;
create policy "Deny direct public access to oauth nonces"
  on public.oauth_state_nonces
  for all
  using (false);

-- ------------------------------------------------------------------------------
-- 2. FUNCTION: consume_oauth_nonce_atomic
-- Atomically registers and consumes an OAuth state nonce.
-- Rejects concurrent callbacks with the exact same nonce via primary key uniqueness.
-- ------------------------------------------------------------------------------
create or replace function public.consume_oauth_nonce_atomic(
  p_nonce text,
  p_org_id uuid,
  p_provider text default 'linear',
  p_ttl_seconds int default 900
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  -- Opportunistic cleanup of expired nonces
  delete from public.oauth_state_nonces where expires_at < v_now;

  -- Atomic insertion: if duplicate, fails constraint cleanly
  insert into public.oauth_state_nonces (nonce, organization_id, provider, expires_at, created_at)
  values (p_nonce, p_org_id, p_provider, v_now + (p_ttl_seconds || ' seconds')::interval, v_now)
  on conflict (nonce) do nothing;

  if found then
    return jsonb_build_object(
      'success', true,
      'code', 'NONCE_CONSUMED'
    );
  else
    return jsonb_build_object(
      'success', false,
      'code', 'NONCE_ALREADY_USED',
      'message', 'OAuth state nonce has already been consumed or replayed.'
    );
  end if;
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. FUNCTION: acquire_linear_refresh_lease
-- Acquires an atomic row-level lock on organization_integrations for token rotation.
-- Prevents concurrent workers from executing competing refresh requests.
-- ------------------------------------------------------------------------------
create or replace function public.acquire_linear_refresh_lease(
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
  where organization_id = p_org_id and provider = 'linear'
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
  where organization_id = p_org_id and provider = 'linear';

  return jsonb_build_object(
    'success', true,
    'code', 'LEASE_ACQUIRED',
    'current_encrypted_refresh_token', v_row.encrypted_refresh_token
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. FUNCTION: release_linear_refresh_lease
-- Safely releases the refresh lease owned by the calling worker.
-- A stale worker cannot release a newer lease held by another worker.
-- ------------------------------------------------------------------------------
create or replace function public.release_linear_refresh_lease(
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
    and provider = 'linear'
    and metadata->>'refresh_lock_worker' = p_worker_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. FUNCTION: save_linear_refreshed_tokens_cas
-- Atomically persists newly rotated tokens with Optimistic Concurrency Control (OCC).
-- Guards against stale workers overwriting newer tokens or releasing newer leases.
-- ------------------------------------------------------------------------------
create or replace function public.save_linear_refreshed_tokens_cas(
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
  v_row record;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_row
  from public.organization_integrations
  where organization_id = p_org_id and provider = 'linear'
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  end if;

  -- Guard against stale overwrites (OCC)
  if p_expected_refresh_token is not null and v_row.encrypted_refresh_token is distinct from p_expected_refresh_token then
    return jsonb_build_object(
      'success', false,
      'code', 'STALE_OVERWRITE_PREVENTED',
      'message', 'Credentials were updated by another worker with a newer token.'
    );
  end if;

  -- Guard against updating another worker's active lease
  if (v_row.metadata->>'refresh_lock_worker') is not null and
     (v_row.metadata->>'refresh_lock_worker') != p_worker_id and
     (v_row.metadata->>'refresh_lock_until')::timestamptz > v_now then
    return jsonb_build_object(
      'success', false,
      'code', 'LEASE_LOST',
      'message', 'Active lease was acquired by another worker.'
    );
  end if;

  -- Atomically commit rotated credentials and release lease
  update public.organization_integrations
  set encrypted_access_token = p_new_encrypted_access,
      encrypted_refresh_token = coalesce(p_new_encrypted_refresh, encrypted_refresh_token),
      token_expires_at = p_token_expires_at,
      status = 'connected',
      metadata = metadata - 'refresh_lock_until' - 'refresh_lock_worker',
      updated_at = v_now
  where organization_id = p_org_id and provider = 'linear';

  return jsonb_build_object('success', true, 'code', 'COMMITTED');
end;
$$;
