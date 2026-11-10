-- ==============================================================================
-- Company Brain: Rate Limit Entries Schema Alignment
-- Migration: 00028_rate_limit_schema_alignment.sql
-- Description: Aligns public.rate_limit_entries table with migration 00025 
--              check_rate_limit RPC (tokens & last_refill).
-- 
-- Guarantees:
-- 1. Idempotent schema evolution: adds tokens & last_refill safely if missing.
-- 2. Non-permissive, deterministic data migration: backfills tokens from legacy
--    count/points (including 0, 1, and higher) and last_refill from window_start/
--    updated_at/expire_at without relying on elapsed migration wall-clock intervals.
-- 3. Zero data loss: preserves all legacy columns (count, points, window_start, 
--    expire_at, updated_at) to ensure complete backward compatibility.
-- 4. RLS & Permissions integrity: table remains strictly protected with RLS enabled
--    and zero public access; only accessible via SECURITY DEFINER check_rate_limit.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Ensure public.rate_limit_entries exists with base structure
-- ------------------------------------------------------------------------------
create table if not exists public.rate_limit_entries (
  key text primary key
);

-- ------------------------------------------------------------------------------
-- 2. Add canonical columns without default values to distinguish new vs unmigrated rows
-- ------------------------------------------------------------------------------
alter table public.rate_limit_entries 
  add column if not exists tokens integer,
  add column if not exists last_refill timestamptz;

-- ------------------------------------------------------------------------------
-- 3. Deterministic Non-Permissive Backfill from Any Legacy Schema Variant
-- ------------------------------------------------------------------------------
do $$
declare
  v_has_count boolean := false;
  v_has_points boolean := false;
  v_has_window_start boolean := false;
  v_has_updated_at boolean := false;
  v_has_expire_at boolean := false;
  v_token_expr text := '1';
  v_refill_expr text := 'clock_timestamp()';
begin
  select exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'rate_limit_entries' and column_name = 'count'
  ) into v_has_count;

  select exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'rate_limit_entries' and column_name = 'points'
  ) into v_has_points;

  select exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'rate_limit_entries' and column_name = 'window_start'
  ) into v_has_window_start;

  select exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'rate_limit_entries' and column_name = 'updated_at'
  ) into v_has_updated_at;

  select exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'rate_limit_entries' and column_name = 'expire_at'
  ) into v_has_expire_at;

  -- Build token resolution expression preserving all consumed attempts (0, 1, or higher)
  -- When count and points coexist, GREATEST ensures non-permissive security:
  -- the higher value of consumed attempts is strictly preserved so no additional attempts are granted.
  if v_has_count and v_has_points then
    v_token_expr := 'case when count is not null or points is not null then greatest(coalesce(count, 0), coalesce(points, 0)) else 1 end';
  elsif v_has_count then
    v_token_expr := 'coalesce(count, 1)';
  elsif v_has_points then
    v_token_expr := 'coalesce(points, 1)';
  else
    v_token_expr := '1';
  end if;

  -- Build refill timestamp expression without wall-clock interval dependencies
  if v_has_window_start and v_has_updated_at and v_has_expire_at then
    v_refill_expr := 'coalesce(window_start, updated_at, expire_at, clock_timestamp())';
  elsif v_has_window_start and v_has_updated_at then
    v_refill_expr := 'coalesce(window_start, updated_at, clock_timestamp())';
  elsif v_has_window_start then
    v_refill_expr := 'coalesce(window_start, clock_timestamp())';
  elsif v_has_updated_at then
    v_refill_expr := 'coalesce(updated_at, clock_timestamp())';
  elsif v_has_expire_at then
    v_refill_expr := 'coalesce(expire_at, clock_timestamp())';
  else
    v_refill_expr := 'clock_timestamp()';
  end if;

  -- Perform explicit backfill strictly where tokens or last_refill are currently NULL
  execute format(
    'update public.rate_limit_entries
     set tokens = coalesce(tokens, %s),
         last_refill = coalesce(last_refill, %s)
     where tokens is null or last_refill is null',
    v_token_expr,
    v_refill_expr
  );
end $$;

-- ------------------------------------------------------------------------------
-- 4. Apply NOT NULL constraints and defaults for future inserts
-- ------------------------------------------------------------------------------
alter table public.rate_limit_entries 
  alter column tokens set default 1,
  alter column tokens set not null,
  alter column last_refill set default now(),
  alter column last_refill set not null;

-- ------------------------------------------------------------------------------
-- 5. Strict RLS and Least-Privilege Grants
-- ------------------------------------------------------------------------------
alter table public.rate_limit_entries enable row level security;
revoke all on table public.rate_limit_entries from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on table public.rate_limit_entries to service_role;
  end if;
  if exists (select 1 from pg_roles where rolname = 'postgres') then
    grant all on table public.rate_limit_entries to postgres;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 6. Reload PostgREST schema cache
-- ------------------------------------------------------------------------------
notify pgrst, 'reload schema';
