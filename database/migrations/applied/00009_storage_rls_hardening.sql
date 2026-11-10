-- ==============================================================================
-- Company Brain: Storage RLS & Authorization Helper Hardening
-- Migration: 00009_storage_rls_hardening.sql
-- ==============================================================================

-- 1. Restrict EXECUTE privileges on SECURITY DEFINER helper functions
-- Revoke default PUBLIC execution to prevent unauthenticated RPC probing
revoke execute on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated, service_role, postgres;

revoke execute on function public.has_org_role(uuid, text[]) from public;
grant execute on function public.has_org_role(uuid, text[]) to authenticated, service_role, postgres;

revoke execute on function public.shares_organization_with(uuid) from public;
grant execute on function public.shares_organization_with(uuid) to authenticated, service_role, postgres;

-- 2. Restrict storage.objects policies for organization_files to authenticated users
-- Replaces implicit 'to public' with explicit 'to authenticated'

-- SELECT: Members can read organization files
drop policy if exists "Members can read organization files" on storage.objects;
create policy "Members can read organization files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'organization_files'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

-- INSERT: Members can upload files to their organization
drop policy if exists "Members can upload files to their organization" on storage.objects;
create policy "Members can upload files to their organization"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'organization_files'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

-- UPDATE: Owners and admins can update organization files
drop policy if exists "Owners and admins can update organization files" on storage.objects;
create policy "Owners and admins can update organization files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'organization_files'
    and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
  );

-- DELETE: Owners and admins can delete organization files
drop policy if exists "Owners and admins can delete organization files" on storage.objects;
create policy "Owners and admins can delete organization files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'organization_files'
    and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
  );

notify pgrst, 'reload schema';
