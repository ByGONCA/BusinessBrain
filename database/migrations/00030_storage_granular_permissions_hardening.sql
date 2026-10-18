-- ==============================================================================
-- Migration 00030: Supabase Storage Objects Granular Permissions & RLS Hardening
-- ==============================================================================
-- Description: Hardens storage.objects Row Level Security (RLS) policies for the
--              'organization_files' bucket to enforce the 52-key permissions engine
--              (files.view, files.upload, files.delete) directly at the database level.
--
-- Defense-in-depth: Prevents direct Supabase Client SDK bypasses where an authenticated
--                   workspace member with DENY on files.upload or files.view attempts
--                   to directly read, insert, or delete objects in storage.objects.
--
-- Requirements:
--   1. Ensures folder structure strictly conforms to [organization_id]/...
--   2. Prevents UUID cast exceptions from malicious or malformed folder paths.
--   3. Enforces owner/admin authority or explicit granular permission keys.
-- ==============================================================================

-- 1. SELECT: Members with files.view (or owner/admin role) can read organization files
DROP POLICY IF EXISTS "Members can read organization files" ON storage.objects;
DROP POLICY IF EXISTS "Authorized members can read organization files" ON storage.objects;

CREATE POLICY "Authorized members can read organization files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'organization_files'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.has_org_role((storage.foldername(name))[1]::uuid, ARRAY['owner', 'admin'])
      OR public.has_permission((storage.foldername(name))[1]::uuid, 'files.view')
    )
  );

-- 2. INSERT: Members with files.upload (or owner/admin role) can upload files
DROP POLICY IF EXISTS "Members can upload files to their organization" ON storage.objects;
DROP POLICY IF EXISTS "Authorized members can upload organization files" ON storage.objects;

CREATE POLICY "Authorized members can upload organization files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'organization_files'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.has_org_role((storage.foldername(name))[1]::uuid, ARRAY['owner', 'admin'])
      OR public.has_permission((storage.foldername(name))[1]::uuid, 'files.upload')
    )
  );

-- 3. UPDATE: Owners, admins, or members with files.delete can update file records
DROP POLICY IF EXISTS "Owners and admins can update organization files" ON storage.objects;
DROP POLICY IF EXISTS "Authorized members can update organization files" ON storage.objects;

CREATE POLICY "Authorized members can update organization files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'organization_files'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.has_org_role((storage.foldername(name))[1]::uuid, ARRAY['owner', 'admin'])
      OR public.has_permission((storage.foldername(name))[1]::uuid, 'files.delete')
    )
  );

-- 4. DELETE: Members with files.delete (or owner/admin role) can delete files
DROP POLICY IF EXISTS "Owners and admins can delete organization files" ON storage.objects;
DROP POLICY IF EXISTS "Authorized members can delete organization files" ON storage.objects;

CREATE POLICY "Authorized members can delete organization files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'organization_files'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.has_org_role((storage.foldername(name))[1]::uuid, ARRAY['owner', 'admin'])
      OR public.has_permission((storage.foldername(name))[1]::uuid, 'files.delete')
    )
  );

NOTIFY pgrst, 'reload schema';
