-- ==============================================================================
-- Company Brain: Explicit & Granular Data API Privilege Matrix
-- Migration: 00034_explicit_table_grants_data_api.sql
--
-- Security Profile:
-- 1. Complies with Supabase October 30 Data API policy without granting broad CRUD.
-- 2. Granular permissions tailored to each table's exact operational role:
--    - Subscriptions: SELECT only for authenticated (mutations via Stripe webhooks/backend).
--    - Audit Logs & Activity: SELECT, INSERT only (immutable audit trail; zero UPDATE/DELETE).
--    - Notifications & Integrations: SELECT, UPDATE, DELETE (cannot forge inserts directly).
--    - Tenant Content: SELECT, INSERT, UPDATE, DELETE (strictly filtered by Row Level Security).
--    - Server-Only Secrets & Infrastructure: service_role ONLY (zero anon or authenticated access).
-- 3. Excludes ALTER DEFAULT PRIVILEGES (all future tables must define explicit grants in their migrations).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SERVER-ONLY & SECRET TABLES (service_role ONLY)
-- Strict lockdown: zero access for anon or authenticated roles
-- ------------------------------------------------------------------------------

-- 1.1. Internal System Secrets (HMAC keys for RPC authentication)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'internal_system_secrets') then
    revoke all on table public.internal_system_secrets from public, anon, authenticated;
    grant select, insert, update on table public.internal_system_secrets to service_role;
  end if;
end $$;

-- 1.2. Stripe Webhook Events (Raw webhook payloads & delivery ledger)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'stripe_webhook_events') then
    revoke all on table public.stripe_webhook_events from public, anon, authenticated;
    grant all on table public.stripe_webhook_events to service_role;
  end if;
end $$;

-- 1.3. OAuth Nonce Ledger (Single-use CSRF tokens for external provider OAuth)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'oauth_nonce_ledger') then
    revoke all on table public.oauth_nonce_ledger from public, anon, authenticated;
    grant all on table public.oauth_nonce_ledger to service_role;
  end if;
end $$;

-- 1.4. Rate Limit Entries & Buckets (Handled exclusively via check_rate_limit SECURITY DEFINER RPC)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'rate_limit_entries') then
    revoke all on table public.rate_limit_entries from public, anon, authenticated;
    grant all on table public.rate_limit_entries to service_role;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'rate_limit_buckets') then
    revoke all on table public.rate_limit_buckets from public, anon, authenticated;
    grant all on table public.rate_limit_buckets to service_role;
  end if;
end $$;

-- 1.5. Integration Tokens (Encrypted OAuth access/refresh tokens)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'integration_tokens') then
    revoke all on table public.integration_tokens from public, anon, authenticated;
    grant all on table public.integration_tokens to service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 2. READ-ONLY BILLING & METRICS TABLES (authenticated: SELECT only)
-- Mutations handled strictly by verified webhooks, server background sync, or cron
-- ------------------------------------------------------------------------------

-- 2.1. Subscriptions (Prevent client-side subscription manipulation)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'subscriptions') then
    revoke all on table public.subscriptions from public, anon;
    revoke insert, update, delete on table public.subscriptions from authenticated;
    grant select on table public.subscriptions to authenticated;
    grant all on table public.subscriptions to service_role;
  end if;
end $$;

-- 2.2. Organization Metric Snapshots (Generated strictly by server cron)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'organization_metric_snapshots') then
    revoke all on table public.organization_metric_snapshots from public, anon;
    revoke insert, update, delete on table public.organization_metric_snapshots from authenticated;
    grant select on table public.organization_metric_snapshots to authenticated;
    grant all on table public.organization_metric_snapshots to service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 3. APPEND-ONLY AUDIT & ACTIVITY LOGS (authenticated: SELECT, INSERT only)
-- Strict immutability: zero UPDATE or DELETE allowed for users
-- ------------------------------------------------------------------------------

-- 3.1. Audit Logs (Compliance & operational audit trail)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'audit_logs') then
    revoke all on table public.audit_logs from public, anon;
    revoke update, delete on table public.audit_logs from authenticated;
    grant select, insert on table public.audit_logs to authenticated;
    grant all on table public.audit_logs to service_role;
  end if;
end $$;

-- 3.2. Page Activity (Document revision & view stream)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'page_activity') then
    revoke all on table public.page_activity from public, anon;
    revoke update, delete on table public.page_activity from authenticated;
    grant select, insert on table public.page_activity to authenticated;
    grant all on table public.page_activity to service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 4. CONTROLLED SETTINGS & USER NOTIFICATIONS (SELECT, UPDATE, optional INSERT/DELETE)
-- ------------------------------------------------------------------------------

-- 4.1. User Profiles (Users read/update own profile; created via trigger/onboarding)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    revoke all on table public.profiles from public, anon;
    grant select, insert, update on table public.profiles to authenticated;
    grant all on table public.profiles to service_role;
  end if;
end $$;

-- 4.2. Organization Settings (Workspace defaults & branding)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'organization_settings') then
    revoke all on table public.organization_settings from public, anon;
    grant select, insert, update on table public.organization_settings to authenticated;
    grant all on table public.organization_settings to service_role;
  end if;
end $$;

-- 4.3. Notification Preferences (User delivery preferences)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notification_preferences') then
    revoke all on table public.notification_preferences from public, anon;
    grant select, insert, update on table public.notification_preferences to authenticated;
    grant all on table public.notification_preferences to service_role;
  end if;
end $$;

-- 4.4. User Notifications (Users read, mark read, or dismiss; inserts via system/actions)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_notifications') then
    revoke all on table public.user_notifications from public, anon;
    grant select, update, delete on table public.user_notifications to authenticated;
    grant all on table public.user_notifications to service_role;
  end if;
end $$;

-- 4.5. Organization Integrations (Status check, configure, and disconnect)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'organization_integrations') then
    revoke all on table public.organization_integrations from public, anon;
    grant select, update, delete on table public.organization_integrations to authenticated;
    grant all on table public.organization_integrations to service_role;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 5. TENANT COLLABORATION & CONTENT TABLES (authenticated: full CRUD gated by RLS)
-- ------------------------------------------------------------------------------

do $$
declare
  t text;
  v_crud_tables text[] := array[
    'organizations',
    'organization_members',
    'organization_invitations',
    'pages',
    'page_connections',
    'company_connections',
    'company_entities',
    'organization_files',
    'page_files',
    'page_versions',
    'page_comments',
    'entity_comments',
    'organization_calendar_events',
    'organization_teams',
    'organization_team_members',
    'team_permissions',
    'member_permission_overrides',
    'resource_permissions',
    'github_repositories',
    'github_connections',
    'company_memories'
  ];
begin
  foreach t in array v_crud_tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('revoke all on table public.%I from public, anon;', t);
      execute format('grant select, insert, update, delete on table public.%I to authenticated;', t);
      execute format('grant all on table public.%I to service_role;', t);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------------------------
-- 6. AUDIT & ASSERTIONS ON EFFECTIVE PRIVILEGES & RLS
-- Verifies that RLS is active on every exposed table and that no sensitive privileges leak.
-- ------------------------------------------------------------------------------
do $$
declare
  v_err text := '';
  v_count int;
begin
  -- 6.1. Confirm RLS is enabled on all tables in public schema
  select count(*) into v_count
  from pg_tables pt
  join pg_class pc on pc.relname = pt.tablename
  join pg_namespace pn on pn.oid = pc.relnamespace and pn.nspname = 'public'
  where pt.schemaname = 'public'
    and pc.relrowsecurity = false;

  if v_count > 0 then
    raise exception 'SECURITY VIOLATION: Found % tables in schema public with Row Level Security (RLS) disabled', v_count;
  end if;

  -- 6.2. Confirm anon has ZERO table privileges across all public tables
  select count(*) into v_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon';

  if v_count > 0 then
    raise exception 'SECURITY VIOLATION: Found % table grants to anon in schema public', v_count;
  end if;

  -- 6.3. Confirm authenticated has NO update or delete permissions on subscriptions
  select count(*) into v_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'subscriptions'
    and grantee = 'authenticated'
    and privilege_type in ('UPDATE', 'DELETE', 'INSERT');

  if v_count > 0 then
    raise exception 'SECURITY VIOLATION: authenticated has write/delete privileges on subscriptions (count: %)', v_count;
  end if;

  -- 6.4. Confirm authenticated has NO update or delete permissions on audit_logs
  select count(*) into v_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'audit_logs'
    and grantee = 'authenticated'
    and privilege_type in ('UPDATE', 'DELETE');

  if v_count > 0 then
    raise exception 'SECURITY VIOLATION: authenticated has update/delete privileges on audit_logs (count: %)', v_count;
  end if;

  -- 6.5. Confirm internal_system_secrets is strictly accessible to service_role ONLY
  select count(*) into v_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'internal_system_secrets'
    and grantee <> 'service_role';

  if v_count > 0 then
    raise exception 'SECURITY VIOLATION: internal_system_secrets is accessible to unauthorized roles (count: %)', v_count;
  end if;

  raise notice 'POST-VERIFICATION PASSED: All public tables have RLS enabled, granular privileges verified, and zero secret leakage.';
end $$;

COMMIT;
