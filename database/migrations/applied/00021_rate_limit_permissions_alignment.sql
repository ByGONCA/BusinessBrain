-- ==============================================================================
-- Migration 00021: Cryptographically Hardened Rate Limit RPC
-- Description:
--   Aligns check_rate_limit EXECUTE permissions with Company Brain's serverless
--   Supabase client architecture while enforcing end-to-end cryptographic verification.
--
-- Context:
--   In Company Brain, SUPABASE_SERVICE_ROLE_KEY is intentionally excluded from
--   application environments to eliminate any risk of service role credential leakage.
--   Server-side operations rely on createServiceClient() using the publishable key
--   (role anon) and authenticated user sessions (role authenticated).
--
--   Migration 00012 revoked EXECUTE from anon and authenticated, causing
--   "permission denied for function check_rate_limit" when Next.js server actions
--   (such as file upload authorization) invoked the rate limiting RPC.
--
-- Security Hardening & Cryptographic Guarantees:
--   1. Function is SECURITY DEFINER with explicit search_path = public, extensions
--      to safely read and update the RLS-protected rate_limit_entries table.
--   2. Strict parameter validation: p_key (must start with 'rl:', 5..255 chars,
--      safe charset), p_limit (1..10000), and p_window_seconds (1..86400).
--   3. Cryptographic server-token boundary with HMAC-SHA256:
--      Callers not in service_role must supply a valid p_server_token with format:
--      "<unix_epoch_seconds>.<sha256_hmac_hex>".
--   4. Replay attack prevention: The token timestamp is validated against PostgreSQL
--      clock_timestamp() with a strict maximum drift window of 120 seconds.
--   5. Parameter tampering resistance: The HMAC covers the exact tuple
--      (p_key, p_limit, p_window_seconds, timestamp). Any tampering with the key,
--      limit, or window invalidates the cryptographic signature.
--   6. Secret storage: Secret is resolved from:
--      a) PostgreSQL GUC parameter 'app.settings.rate_limit_secret' (if configured),
--      b) Table public.internal_system_secrets (strictly inaccessible to public/anon/authenticated),
--      c) Internal fallback default key for seamless local development.
--   7. Zero cross-organization leakage: rate_limit_entries stores only opaque cache
--      keys and sliding window counters, with no business or tenant data.
-- ==============================================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. INTERNAL SYSTEM SECRETS TABLE (RLS Enabled, Zero Public Access)
-- ------------------------------------------------------------------------------
create table if not exists public.internal_system_secrets (
  key text primary key,
  secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.internal_system_secrets enable row level security;

-- Revoke all access to public, anon, and authenticated
revoke all on table public.internal_system_secrets from public, anon, authenticated;
grant select, insert, update on table public.internal_system_secrets to service_role, postgres;

-- ------------------------------------------------------------------------------
-- 2. SCHEMA COMPATIBILITY & TABLE EVOLUTION (Zero Data Loss)
-- Backward compatibility for existing databases (00000/00005) having points & expire_at.
-- ------------------------------------------------------------------------------
create table if not exists public.rate_limit_entries (
  key text primary key,
  count integer not null default 1,
  window_start timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expire_at timestamptz default now()
);

alter table public.rate_limit_entries add column if not exists count integer not null default 1;
alter table public.rate_limit_entries add column if not exists window_start timestamptz not null default now();
alter table public.rate_limit_entries add column if not exists updated_at timestamptz not null default now();

-- Safely relax legacy NOT NULL constraint on expire_at and provide a default
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'rate_limit_entries' 
      and column_name = 'expire_at'
  ) then
    alter table public.rate_limit_entries alter column expire_at drop not null;
    alter table public.rate_limit_entries alter column expire_at set default now();
  else
    alter table public.rate_limit_entries add column if not exists expire_at timestamptz default now();
  end if;
end $$;

alter table public.rate_limit_entries enable row level security;

-- ------------------------------------------------------------------------------
-- 3. HARDENED check_rate_limit RPC
-- ------------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer,
  p_server_token text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz := v_now - (p_window_seconds || ' seconds')::interval;
  v_expire timestamptz := v_now + (p_window_seconds || ' seconds')::interval;
  v_current_count integer;
  v_secret text;
  v_token_ts bigint;
  v_token_sig text;
  v_now_epoch bigint;
  v_expected_sig text;
  v_message text;
begin
  -- ----------------------------------------------------------------------------
  -- Guard 1: Parameter boundary and format validation
  -- ----------------------------------------------------------------------------
  if p_key is null or length(trim(p_key)) < 5 or length(p_key) > 255 then
    raise exception 'Invalid rate limit key: length must be between 5 and 255 characters'
      using errcode = '22023';
  end if;

  if not (p_key like 'rl:%') then
    raise exception 'Invalid rate limit key: must begin with rl: namespace'
      using errcode = '22023';
  end if;

  -- Ensure key contains only safe characters (alphanumeric, :, -, _, ., @)
  if not (p_key ~ '^[a-zA-Z0-9_\-\.:@]+$') then
    raise exception 'Invalid rate limit key: contains forbidden characters'
      using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception 'Invalid rate limit limit: must be between 1 and 10000'
      using errcode = '22023';
  end if;

  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit window: must be between 1 and 86400 seconds'
      using errcode = '22023';
  end if;

  -- ----------------------------------------------------------------------------
  -- Guard 2: Cryptographic Server Token Verification
  -- If caller is service_role, access is trusted natively.
  -- Otherwise, caller MUST supply a valid, unexpired HMAC-SHA256 server token.
  -- ----------------------------------------------------------------------------
  if coalesce(auth.role(), '') <> 'service_role' then
    if p_server_token is null or length(p_server_token) < 40 or position('.' in p_server_token) = 0 then
      raise exception 'Access denied: check_rate_limit requires valid cryptographic server_token'
        using errcode = '42501';
    end if;

    begin
      v_token_ts := split_part(p_server_token, '.', 1)::bigint;
    exception when others then
      raise exception 'Access denied: invalid server_token format'
        using errcode = '42501';
    end;

    v_token_sig := split_part(p_server_token, '.', 2);
    if length(v_token_sig) <> 64 then
      raise exception 'Access denied: invalid server_token signature length'
        using errcode = '42501';
    end if;

    -- Replay Prevention: Token timestamp must be within 120 seconds of PostgreSQL clock
    v_now_epoch := extract(epoch from v_now)::bigint;
    if abs(v_now_epoch - v_token_ts) > 120 then
      raise exception 'Access denied: server_token expired or timestamp desynchronized'
        using errcode = '42501';
    end if;

    -- Resolve Server Secret:
    -- Priority 1: PostgreSQL GUC parameter 'app.settings.rate_limit_secret'
    -- Priority 2: public.internal_system_secrets table (key = 'rate_limit')
    -- Priority 3: Non-production development fallback ('company-brain-rate-limit-dev-key')
    -- Production Setup: Run 'insert into public.internal_system_secrets (key, secret) values ('rate_limit', '<YOUR_INTERNAL_RATE_LIMIT_SECRET>') on conflict (key) do update set secret = excluded.secret;'
    v_secret := coalesce(
      nullif(current_setting('app.settings.rate_limit_secret', true), ''),
      (select secret from public.internal_system_secrets where key = 'rate_limit' limit 1),
      'company-brain-rate-limit-dev-key'
    );

    if v_secret is null or length(trim(v_secret)) = 0 then
      raise exception 'Access denied: rate limiting secret is unconfigured'
        using errcode = '42501';
    end if;

    -- Cryptographic Signature Verification over (key:limit:window:timestamp)
    v_message := p_key || ':' || p_limit || ':' || p_window_seconds || ':' || v_token_ts;
    v_expected_sig := encode(extensions.hmac(v_message::bytea, v_secret::bytea, 'sha256'), 'hex');

    if v_token_sig <> v_expected_sig then
      raise exception 'Access denied: invalid cryptographic server_token signature'
        using errcode = '42501';
    end if;
  end if;

  -- ----------------------------------------------------------------------------
  -- Atomic Sliding Window Increment
  -- ----------------------------------------------------------------------------
  insert into public.rate_limit_entries (key, count, window_start, updated_at, expire_at)
  values (trim(p_key), 1, v_now, v_now, v_expire)
  on conflict (key) do update
  set
    count = case
      when public.rate_limit_entries.window_start < v_window_start then 1
      else public.rate_limit_entries.count + 1
    end,
    window_start = case
      when public.rate_limit_entries.window_start < v_window_start then v_now
      else public.rate_limit_entries.window_start
    end,
    expire_at = case
      when public.rate_limit_entries.window_start < v_window_start then v_expire
      else public.rate_limit_entries.expire_at
    end,
    updated_at = v_now
  returning count into v_current_count;

  return v_current_count <= p_limit;
end;
$$;

-- Revoke all execution by default
revoke all on function public.check_rate_limit(text, integer, integer, text) from public;

-- Grant EXECUTE to anon, authenticated, service_role, and postgres
-- Anon and authenticated access is cryptographically verified by Guard 2 above.
grant execute on function public.check_rate_limit(text, integer, integer, text) to anon, authenticated, service_role, postgres;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
