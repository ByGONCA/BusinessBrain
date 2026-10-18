-- ==============================================================================
-- Migration 00026: Security Advisor Privilege Remedy & Precision Hardening
-- 
-- Resolves persistent Supabase Security Advisor warnings post-00025:
-- 1. Eliminates authenticated_security_definer_function_executable on:
--    - public.update_calendar_events_updated_at (internal trigger function: revoke from authenticated)
--    - public.get_organization_storage_bytes (convert to SECURITY INVOKER: executes under caller's RLS)
-- 
-- 2. Preserves intentional & cryptographically guarded functions:
--    - is_org_member, has_org_role, shares_organization_with (required SECURITY DEFINER to prevent RLS infinite recursion)
--    - has_permission (required SECURITY DEFINER to compute 5 canonical rules without exposing override tables)
--    - accept_organization_invitation (required SECURITY DEFINER to add new member prior to membership existence)
--    - check_rate_limit, get_invitation_details (guarded via RFC 2104 HMAC-SHA-256 server token)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FIX: update_calendar_events_updated_at (Trigger Function Lockdown & Invoker)
-- Redefined as SECURITY INVOKER with empty search_path.
-- Trigger functions must NOT be directly executable via PostgREST API.
-- ------------------------------------------------------------------------------
create or replace function public.update_calendar_events_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

revoke all on function public.update_calendar_events_updated_at() from public, anon;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.update_calendar_events_updated_at() from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.update_calendar_events_updated_at() to service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 2. FIX: get_organization_storage_bytes (Convert to SECURITY INVOKER)
-- Callers already have SELECT RLS policies on organization_files via is_org_member.
-- Running as SECURITY INVOKER eliminates the Advisor warning entirely.
-- ------------------------------------------------------------------------------
create or replace function public.get_organization_storage_bytes(p_org_id uuid)
returns bigint
language plpgsql
security invoker
stable
set search_path = ''
as $$
begin
  if p_org_id is null then
    return 0;
  end if;

  -- Caller must belong to the organization
  if not public.is_org_member(p_org_id) and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Access denied: caller does not belong to the requested organization'
      using errcode = '42501';
  end if;

  return (
    select coalesce(sum(size_bytes), 0)::bigint
    from public.organization_files
    where organization_id = p_org_id
      and storage_provider = 'company_brain'
      and deleted_at is null
  );
end;
$$;

revoke all on function public.get_organization_storage_bytes(uuid) from public, anon;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.get_organization_storage_bytes(uuid) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.get_organization_storage_bytes(uuid) to service_role;
  end if;
end $$;
