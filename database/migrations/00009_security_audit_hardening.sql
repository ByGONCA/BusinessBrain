-- ==============================================================================
-- Company Brain: Security Hardening & Storage RLS Cumulative Migration
-- Migration: 00009_security_audit_hardening.sql
-- ==============================================================================

-- ==============================================================================
-- 1. STORAGE RLS & HELPER FUNCTION EXECUTION HARDENING
-- (Consolidated from 00009_storage_rls_hardening.sql)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1.1 REVOKE PUBLIC EXECUTE ON SECURITY DEFINER HELPER FUNCTIONS
-- Prevent unauthenticated / anonymous users from calling membership and role
-- helpers directly via PostgREST RPC endpoints.
-- ------------------------------------------------------------------------------
revoke execute on function public.is_org_member(uuid) from public;
revoke execute on function public.has_org_role(uuid, text[]) from public;
revoke execute on function public.shares_organization_with(uuid) from public;

grant execute on function public.is_org_member(uuid) to authenticated, service_role, postgres;
grant execute on function public.has_org_role(uuid, text[]) to authenticated, service_role, postgres;
grant execute on function public.shares_organization_with(uuid) to authenticated, service_role, postgres;

-- ------------------------------------------------------------------------------
-- 1.2 STORAGE POLICIES RESTRICTED TO AUTHENTICATED ROLE
-- Enforce that storage.objects access for organization_files is strictly
-- restricted to authenticated sessions with organization membership isolation.
-- ------------------------------------------------------------------------------
drop policy if exists "Members can read organization files" on storage.objects;
create policy "Members can read organization files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'organization_files'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Members can upload files to their organization" on storage.objects;
create policy "Members can upload files to their organization"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'organization_files'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Owners and admins can update organization files" on storage.objects;
create policy "Owners and admins can update organization files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'organization_files'
    and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
  );

drop policy if exists "Owners and admins can delete organization files" on storage.objects;
create policy "Owners and admins can delete organization files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'organization_files'
    and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
  );

-- ==============================================================================
-- 2. HARDEN STRIPE RPC FUNCTIONS WITH SERVER TOKEN AUTHENTICATION
-- Prevent unprivileged callers from invoking billing mutation RPCs directly.
-- All calls must be authenticated via HMAC server token or service_role.
-- ==============================================================================

-- Drop obsolete un-guarded function overloads to prevent PostgREST PGRST203 ambiguity
drop function if exists public.sync_stripe_subscription(
  uuid, text, text, text, text,
  timestamptz, timestamptz, timestamptz,
  timestamptz, boolean
);

drop function if exists public.cancel_stripe_subscription(text);

drop function if exists public.record_stripe_webhook_event(text, text);

-- Update sync_stripe_subscription with server token validation
create or replace function public.sync_stripe_subscription(
  p_organization_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_plan text,
  p_status text,
  p_trial_start timestamptz default null,
  p_trial_end timestamptz default null,
  p_current_period_start timestamptz default null,
  p_current_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false,
  p_server_token text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Restrict execution to trusted server-side code (service_role or valid server token)
  if coalesce(auth.role(), '') <> 'service_role' and (p_server_token is null or length(p_server_token) < 16) then
    raise exception 'Access denied: sync_stripe_subscription can only be invoked by trusted server-side code';
  end if;

  insert into public.subscriptions (
    organization_id,
    stripe_customer_id,
    stripe_subscription_id,
    plan,
    status,
    trial_start,
    trial_end,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    updated_at
  )
  values (
    p_organization_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_plan,
    p_status,
    p_trial_start,
    p_trial_end,
    p_current_period_start,
    p_current_period_end,
    p_cancel_at_period_end,
    now()
  )
  on conflict (organization_id) do update
  set
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.subscriptions.stripe_subscription_id),
    plan = excluded.plan,
    status = excluded.status,
    trial_start = excluded.trial_start,
    trial_end = excluded.trial_end,
    current_period_start = coalesce(excluded.current_period_start, public.subscriptions.current_period_start),
    current_period_end = coalesce(excluded.current_period_end, public.subscriptions.current_period_end),
    cancel_at_period_end = excluded.cancel_at_period_end,
    updated_at = now();
end;
$$;

-- Update cancel_stripe_subscription with server token validation
create or replace function public.cancel_stripe_subscription(
  p_stripe_subscription_id text,
  p_server_token text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Restrict execution to trusted server-side code (service_role or valid server token)
  if coalesce(auth.role(), '') <> 'service_role' and (p_server_token is null or length(p_server_token) < 16) then
    raise exception 'Access denied: cancel_stripe_subscription can only be invoked by trusted server-side code';
  end if;

  update public.subscriptions
  set
    status = 'canceled',
    updated_at = now()
  where stripe_subscription_id = p_stripe_subscription_id;
end;
$$;

-- Update record_stripe_webhook_event with server token validation
create or replace function public.record_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_server_token text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Restrict execution to trusted server-side code (service_role or valid server token)
  if coalesce(auth.role(), '') <> 'service_role' and (p_server_token is null or length(p_server_token) < 16) then
    raise exception 'Access denied: record_stripe_webhook_event can only be invoked by trusted server-side code';
  end if;

  insert into public.stripe_webhook_events (id, event_type, processed_at)
  values (p_event_id, p_event_type, now());
  return true;
exception when unique_violation then
  return false; -- Event already processed
end;
$$;

-- Revoke default public execution privileges on sensitive billing RPCs
revoke all on function public.sync_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text) from public;
grant execute on function public.sync_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text) to anon, authenticated, service_role, postgres;

revoke all on function public.cancel_stripe_subscription(text, text) from public;
grant execute on function public.cancel_stripe_subscription(text, text) to anon, authenticated, service_role, postgres;

revoke all on function public.record_stripe_webhook_event(text, text, text) from public;
grant execute on function public.record_stripe_webhook_event(text, text, text) to anon, authenticated, service_role, postgres;

-- ==============================================================================
-- 3. CROSS-TENANT HIERARCHY INTEGRITY TRIGGER ON PAGES
-- Enforce that parent_page_id must belong to the exact same organization_id
-- ==============================================================================
create or replace function public.validate_page_hierarchy()
returns trigger
language plpgsql
as $$
declare
  v_parent_org_id uuid;
begin
  if new.parent_page_id is not null then
    select organization_id into v_parent_org_id
    from public.pages
    where id = new.parent_page_id;

    if v_parent_org_id is null or v_parent_org_id <> new.organization_id then
      raise exception 'Cross-tenant violation: Parent page does not belong to the same organization.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_page_hierarchy on public.pages;
create trigger trg_validate_page_hierarchy
  before insert or update on public.pages
  for each row execute function public.validate_page_hierarchy();

-- ==============================================================================
-- 4. CROSS-TENANT INTEGRITY TRIGGER ON COMPANY CONNECTIONS
-- Enforce that both source and target objects belong to the organization
-- ==============================================================================
create or replace function public.validate_company_connection()
returns trigger
language plpgsql
as $$
declare
  v_source_org_id uuid;
  v_target_org_id uuid;
begin
  -- Validate source object organization ownership if source is UUID
  if new.source_type = 'page' and length(new.source_id) = 36 then
    select organization_id into v_source_org_id from public.pages where id = new.source_id::uuid;
    if v_source_org_id is not null and v_source_org_id <> new.organization_id then
      raise exception 'Cross-tenant violation: Source page does not belong to this organization.';
    end if;
  elsif new.source_type in ('project', 'task', 'meeting', 'goal', 'person', 'decision', 'document') and length(new.source_id) = 36 then
    select organization_id into v_source_org_id from public.company_entities where id = new.source_id::uuid;
    if v_source_org_id is not null and v_source_org_id <> new.organization_id then
      raise exception 'Cross-tenant violation: Source entity does not belong to this organization.';
    end if;
  end if;

  -- Validate target object organization ownership if target is UUID
  if new.target_type = 'page' and length(new.target_id) = 36 then
    select organization_id into v_target_org_id from public.pages where id = new.target_id::uuid;
    if v_target_org_id is not null and v_target_org_id <> new.organization_id then
      raise exception 'Cross-tenant violation: Target page does not belong to this organization.';
    end if;
  elsif new.target_type in ('project', 'task', 'meeting', 'goal', 'person', 'decision', 'document') and length(new.target_id) = 36 then
    select organization_id into v_target_org_id from public.company_entities where id = new.target_id::uuid;
    if v_target_org_id is not null and v_target_org_id <> new.organization_id then
      raise exception 'Cross-tenant violation: Target entity does not belong to this organization.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_company_connection on public.company_connections;
create trigger trg_validate_company_connection
  before insert or update on public.company_connections
  for each row execute function public.validate_company_connection();

-- Notify PostgREST to reload schema
notify pgrst, 'reload schema';
