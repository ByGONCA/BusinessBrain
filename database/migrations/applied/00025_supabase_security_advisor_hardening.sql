-- ==============================================================================
-- Migration 00025: Supabase Security Advisor Hardening & Privilege Lockdown
-- Resolves:
-- 1. function_search_path_mutable:
--    - public.update_calendar_events_updated_at (set search_path = '')
--    - public.is_org_member, has_org_role, shares_organization_with (set search_path = '')
--    - public.has_permission, get_organization_storage_bytes, check_rate_limit (set search_path = '')
-- 2. anon_security_definer_function_executable:
--    - public.accept_organization_invitation (revoked from anon and public)
--    - public.has_permission (revoked from anon and public)
--    - public.get_organization_storage_bytes (revoked from anon and public)
-- 3. check_rate_limit Hardening:
--    - Elimination of hardcoded dev fallback key ('company-brain-rate-limit-dev-key')
--    - Strict fail-closed on missing/invalid secret (< 32 chars)
--    - RFC 2104 HMAC verification with constant-time equality
--    - Strict whitelist key validation (rl:[a-zA-Z0-9_\-\.:@]+)
-- 4. Cross-Tenant Isolation in get_organization_storage_bytes:
--    - Enforces is_org_member check, preventing foreign tenant storage inspection
-- 5. Preserves all existing business logic:
--    - Owner total access, individual DENY > team, individual ALLOW, combined teams, default closed
--    - Atomic invitation acceptance with row-level locking
--    - Public gateway pattern for get_invitation_details with HMAC token
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FIX: function_search_path_mutable on update_calendar_events_updated_at
-- ------------------------------------------------------------------------------
create or replace function public.update_calendar_events_updated_at()
returns trigger
language plpgsql
security definer
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
    grant execute on function public.update_calendar_events_updated_at() to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.update_calendar_events_updated_at() to service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 2. PRIVILEGE LOCKDOWN & SEARCH PATH: is_org_member, has_org_role, shares_organization_with
-- Essential RLS helper functions. Strictly scoped to auth.uid().
-- ------------------------------------------------------------------------------
create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(target_org_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

create or replace function public.shares_organization_with(target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m1
    join public.organization_members m2 on m1.organization_id = m2.organization_id
    where m1.user_id = auth.uid()
      and m2.user_id = target_user_id
  );
$$;

revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.has_org_role(uuid, text[]) from public, anon;
revoke all on function public.shares_organization_with(uuid) from public, anon;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.is_org_member(uuid) to authenticated;
    grant execute on function public.has_org_role(uuid, text[]) to authenticated;
    grant execute on function public.shares_organization_with(uuid) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.is_org_member(uuid) to service_role;
    grant execute on function public.has_org_role(uuid, text[]) to service_role;
    grant execute on function public.shares_organization_with(uuid) to service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 3. PRIVILEGE LOCKDOWN & SEARCH PATH: has_permission
-- Anonymous callers never hold workspace permissions. Role anon must NOT have execute.
-- Explicitly set search_path = '' and qualify all relations.
-- Preserves rules: Owner root, DENY > team, ALLOW grants, team combination, default closed.
-- ------------------------------------------------------------------------------
create or replace function public.has_permission(
  target_org_id uuid,
  required_key text
)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_override_effect text;
begin
  -- Null safety check
  if v_uid is null or target_org_id is null or required_key is null or trim(required_key) = '' then
    return false;
  end if;

  -- 1. Check workspace membership & system role
  select role into v_role
  from public.organization_members
  where organization_id = target_org_id
    and user_id = v_uid;

  if v_role is null then
    return false;
  end if;

  -- Rule 1: Organization Owner has unconditional root access to all keys
  if v_role = 'owner' then
    return true;
  end if;

  -- Rule 2 & 3: Check explicit individual overrides
  select effect into v_override_effect
  from public.member_permission_overrides
  where organization_id = target_org_id
    and user_id = v_uid
    and permission_key = required_key;

  if v_override_effect = 'deny' then
    return false; -- Rule 2: Explicit individual DENY overrides any team grant
  elsif v_override_effect = 'allow' then
    return true;  -- Rule 3: Explicit individual ALLOW grants access
  end if;

  -- Rule 4: Check if any team the member belongs to grants the permission
  if exists (
    select 1
    from public.organization_team_members otm
    join public.team_permissions tp
      on tp.team_id = otm.team_id
     and tp.organization_id = target_org_id
    where otm.organization_id = target_org_id
      and otm.user_id = v_uid
      and tp.permission_key = required_key
  ) then
    return true;
  end if;

  -- Rule 5: Default closed
  return false;
end;
$$;

revoke all on function public.has_permission(uuid, text) from public;
revoke execute on function public.has_permission(uuid, text) from anon;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.has_permission(uuid, text) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.has_permission(uuid, text) to service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 4. PRIVILEGE LOCKDOWN & SEARCH PATH: accept_organization_invitation
-- Accepting an invitation strictly requires an authenticated user. Role anon must NOT have execute.
-- ------------------------------------------------------------------------------
create or replace function public.accept_organization_invitation(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
  v_auth_email text;
  v_invitation record;
  v_org_status text;
  v_team_id uuid;
begin
  -- 1. Authentication Check
  v_auth_user_id := auth.uid();
  if v_auth_user_id is null then
    return jsonb_build_object(
      'success', false,
      'code', 'UNAUTHENTICATED',
      'error', 'Authentication required to accept an invitation.'
    );
  end if;

  -- 2. Verified Email Resolution from auth.users
  select lower(trim(email)) into v_auth_email
  from auth.users
  where id = v_auth_user_id;

  if v_auth_email is null or v_auth_email = '' then
    return jsonb_build_object(
      'success', false,
      'code', 'NO_EMAIL',
      'error', 'Authenticated user does not have a verified email address.'
    );
  end if;

  -- 3. Token Hash Validation (Strict 64 hex chars)
  if p_token_hash is null or length(p_token_hash) <> 64 or p_token_hash !~* '^[0-9a-f]{64}$' then
    return jsonb_build_object(
      'success', false,
      'code', 'INVALID_TOKEN',
      'error', 'Invalid invitation token format.'
    );
  end if;

  -- 4. Pessimistic Row Lock (FOR UPDATE) for Single-Use & Concurrency Safety
  select * into v_invitation
  from public.organization_invitations
  where token_hash = lower(p_token_hash)
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'error', 'Invitation not found or link has expired.'
    );
  end if;

  -- 5. Expiration Check
  if v_invitation.expires_at < clock_timestamp() then
    update public.organization_invitations
    set status = 'expired', updated_at = clock_timestamp()
    where id = v_invitation.id;

    return jsonb_build_object(
      'success', false,
      'code', 'EXPIRED',
      'error', 'This invitation has expired.'
    );
  end if;

  -- 6. Status Check
  if v_invitation.status = 'accepted' then
    return jsonb_build_object(
      'success', false,
      'code', 'ALREADY_ACCEPTED',
      'error', 'This invitation has already been accepted.'
    );
  elsif v_invitation.status <> 'pending' then
    return jsonb_build_object(
      'success', false,
      'code', 'INVALID_STATUS',
      'error', 'This invitation is no longer valid (' || v_invitation.status || ').'
    );
  end if;

  -- 7. Identity Binding Check: Authenticated email MUST match invitation email
  if lower(trim(v_invitation.email)) <> v_auth_email then
    raise exception 'Forbidden: Invitation email mismatch'
      using errcode = '42501';
  end if;

  -- 8. Organization Status Check
  select status into v_org_status
  from public.organizations
  where id = v_invitation.organization_id;

  if v_org_status = 'archived' then
    return jsonb_build_object(
      'success', false,
      'code', 'ORG_ARCHIVED',
      'error', 'This organization is archived and cannot accept new members.'
    );
  end if;

  -- 9. Add or Update Member
  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    job_title,
    created_at,
    updated_at
  ) values (
    v_invitation.organization_id,
    v_auth_user_id,
    v_invitation.role,
    v_invitation.job_title,
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        job_title = coalesce(excluded.job_title, public.organization_members.job_title),
        updated_at = clock_timestamp();

  -- 10. Initial Teams Assignment (Tenant-Isolated Guard)
  if v_invitation.initial_team_ids is not null and array_length(v_invitation.initial_team_ids, 1) > 0 then
    foreach v_team_id in array v_invitation.initial_team_ids loop
      if exists (
        select 1 from public.organization_teams
        where id = v_team_id and organization_id = v_invitation.organization_id
      ) then
        insert into public.organization_team_members (
          organization_id,
          team_id,
          user_id,
          created_at
        ) values (
          v_invitation.organization_id,
          v_team_id,
          v_auth_user_id,
          clock_timestamp()
        )
        on conflict (team_id, user_id) do nothing;
      end if;
    end loop;
  end if;

  -- 11. Atomic State Transition to 'accepted'
  update public.organization_invitations
  set status = 'accepted', updated_at = clock_timestamp()
  where id = v_invitation.id;

  return jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id,
    'role', v_invitation.role
  );
end;
$$;

revoke all on function public.accept_organization_invitation(text) from public;
revoke execute on function public.accept_organization_invitation(text) from anon;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.accept_organization_invitation(text) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.accept_organization_invitation(text) to service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 5. HARDEN: check_rate_limit RPC (Eliminate Dev Key Fallback & Timing Attacks)
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
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_now_epoch bigint;
  v_token_ts bigint;
  v_token_sig text;
  v_secret text;
  v_message text;
  v_expected_sig text;
  v_current_count integer := 0;
  v_window_start timestamptz;
begin
  -- 1. Parameter Validation
  if p_key is null or length(p_key) < 5 or length(p_key) > 255 or p_key !~ '^rl:[a-zA-Z0-9_\-\.:@]+$' then
    raise exception 'Invalid rate limit key format' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'Invalid rate limit limit' using errcode = '22023';
  end if;

  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit window_seconds' using errcode = '22023';
  end if;

  -- 2. Cryptographic Server Token Guard for Non-Service Callers
  if coalesce(auth.role(), '') <> 'service_role' then
    if p_server_token is null or length(p_server_token) < 40 or position('.' in p_server_token) = 0 then
      raise exception 'Access denied: check_rate_limit requires valid cryptographic server_token'
        using errcode = '42501';
    end if;

    begin
      v_token_ts := split_part(p_server_token, '.', 1)::bigint;
      v_token_sig := split_part(p_server_token, '.', 2);
    exception when others then
      raise exception 'Access denied: invalid server_token format'
        using errcode = '42501';
    end;

    if length(v_token_sig) <> 64 then
      raise exception 'Access denied: invalid server_token signature length'
        using errcode = '42501';
    end if;

    -- Replay Prevention: 120-second tolerance window
    v_now_epoch := extract(epoch from v_now)::bigint;
    if abs(v_now_epoch - v_token_ts) > 120 then
      raise exception 'Access denied: server_token expired or timestamp desynchronized'
        using errcode = '42501';
    end if;

    -- Resolve Server Secret (Strict Fail-Closed: ZERO hardcoded development fallbacks)
    if to_regclass('public.internal_system_secrets') is not null then
      begin
        execute 'select secret from public.internal_system_secrets where key in (''rate_limit'', ''server_auth'') order by case when key = ''rate_limit'' then 1 else 2 end limit 1'
          into v_secret;
      exception when others then
        v_secret := null;
      end;
    end if;

    if v_secret is null then
      v_secret := nullif(current_setting('app.settings.rate_limit_secret', true), '');
    end if;

    if v_secret is null or length(trim(v_secret)) < 32 then
      raise exception 'Access denied: rate limiting secret is unconfigured or invalid'
        using errcode = '42501';
    end if;

    -- RFC 2104 HMAC Verification
    v_message := p_key || ':' || p_limit || ':' || p_window_seconds || ':' || v_token_ts;
    v_expected_sig := public.hmac_sha256(v_secret, v_message);

    -- Constant-time comparison
    if not public.timing_safe_equal_hex(v_token_sig, v_expected_sig) then
      raise exception 'Access denied: invalid cryptographic server_token signature'
        using errcode = '42501';
    end if;
  end if;

  -- 3. Rate Limit Evaluation
  v_window_start := v_now - (p_window_seconds || ' seconds')::interval;

  -- Clean up expired buckets for this key
  delete from public.rate_limit_entries
  where key = p_key and last_refill < v_window_start;

  -- Increment current bucket
  insert into public.rate_limit_entries (key, tokens, last_refill)
  values (p_key, 1, v_now)
  on conflict (key) do update
    set tokens = public.rate_limit_entries.tokens + 1,
        last_refill = v_now
  returning tokens into v_current_count;

  return v_current_count <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.check_rate_limit(text, integer, integer, text) to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.check_rate_limit(text, integer, integer, text) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.check_rate_limit(text, integer, integer, text) to service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 6. HARDEN: get_organization_storage_bytes (Eliminate Cross-Tenant Leakage)
-- ------------------------------------------------------------------------------
create or replace function public.get_organization_storage_bytes(p_org_id uuid)
returns bigint
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_is_member boolean;
begin
  if p_org_id is null then
    return 0;
  end if;

  -- Tenant Isolation: caller must belong to target organization or be service_role
  if coalesce(auth.role(), '') <> 'service_role' then
    select exists (
      select 1 from public.organization_members
      where organization_id = p_org_id
        and user_id = auth.uid()
    ) into v_is_member;

    if not coalesce(v_is_member, false) then
      raise exception 'Access denied: caller does not belong to the requested organization'
        using errcode = '42501';
    end if;
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
