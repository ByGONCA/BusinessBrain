-- ==============================================================================
-- Company Brain: Deny Anonymous Execution on Core RLS Helper Functions
-- Migration: 00010_revoke_helper_functions_anon.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. REVOKE EXECUTE FROM ANON AND PUBLIC
-- Explicitly revoke execute privileges from both the anon role and the public
-- pseudo-role to deny unauthenticated execution via PostgREST RPC endpoints.
-- ------------------------------------------------------------------------------
revoke execute on function public.is_org_member(uuid) from anon, public;
revoke execute on function public.has_org_role(uuid, text[]) from anon, public;
revoke execute on function public.shares_organization_with(uuid) from anon, public;

-- ------------------------------------------------------------------------------
-- 2. PRESERVE EXECUTION FOR TRUSTED ROLES
-- Re-affirm execute privileges for authenticated users, service role, and postgres.
-- ------------------------------------------------------------------------------
grant execute on function public.is_org_member(uuid) to authenticated, service_role, postgres;
grant execute on function public.has_org_role(uuid, text[]) to authenticated, service_role, postgres;
grant execute on function public.shares_organization_with(uuid) to authenticated, service_role, postgres;

-- ------------------------------------------------------------------------------
-- 3. RELOAD POSTGREST SCHEMA CACHE
-- Notify PostgREST to immediately refresh endpoint permissions.
-- ------------------------------------------------------------------------------
notify pgrst, 'reload schema';
