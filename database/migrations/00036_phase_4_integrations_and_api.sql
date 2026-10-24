-- ==============================================================================
-- Company Brain: Phase 4 Integrations, Ecosystem & Public API Schema
-- Migration: 00036_phase_4_integrations_and_api.sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. INTEGRATION SYNC LOGS TABLE
-- Tracks sync jobs, items synced/failed, execution duration, and errors.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.integration_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.organization_integrations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  sync_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed', 'partial')),
  items_synced integer NOT NULL DEFAULT 0 CHECK (items_synced >= 0),
  items_failed integer NOT NULL DEFAULT 0 CHECK (items_failed >= 0),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_org_created 
  ON public.integration_sync_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_logs_provider 
  ON public.integration_sync_logs (organization_id, provider, status);

ALTER TABLE public.integration_sync_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. ENTERPRISE PUBLIC API KEYS TABLE
-- Stores SHA-256 hashed API keys with prefix, scopes, rate limit, and lifecycle.
-- Raw API key secret is never persisted.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organization_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 100),
  key_prefix text NOT NULL CHECK (length(key_prefix) >= 8),
  key_hash text NOT NULL UNIQUE CHECK (length(key_hash) = 64),
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rate_limit_per_minute integer NOT NULL DEFAULT 60 CHECK (rate_limit_per_minute > 0 AND rate_limit_per_minute <= 1000),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org 
  ON public.organization_api_keys (organization_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash 
  ON public.organization_api_keys (key_hash) 
  WHERE revoked_at IS NULL;

ALTER TABLE public.organization_api_keys ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_org_api_keys_updated_at ON public.organization_api_keys;
CREATE TRIGGER set_org_api_keys_updated_at
  BEFORE UPDATE ON public.organization_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. IMPORTED DOCUMENTS TABLE (Confluence, Notion, Drive)
-- Stores imported knowledge artifacts preserving external references and hierarchy.
-- SHA-256 content hash guarantees idempotence and prevents duplicate imports.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.imported_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_platform text NOT NULL CHECK (source_platform IN ('confluence', 'notion', 'google_drive', 'markdown')),
  source_id text NOT NULL,
  source_url text,
  parent_source_id text,
  title text NOT NULL,
  content_format text NOT NULL DEFAULT 'markdown',
  content_payload text NOT NULL,
  content_hash text NOT NULL CHECK (length(content_hash) = 64),
  target_page_id uuid REFERENCES public.pages(id) ON DELETE SET NULL,
  sync_status text NOT NULL DEFAULT 'imported' CHECK (sync_status IN ('imported', 'updated', 'failed', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_imported_docs_source UNIQUE (organization_id, source_platform, source_id)
);

CREATE INDEX IF NOT EXISTS idx_imported_docs_org_platform 
  ON public.imported_documents (organization_id, source_platform);

CREATE INDEX IF NOT EXISTS idx_imported_docs_parent 
  ON public.imported_documents (organization_id, source_platform, parent_source_id);

ALTER TABLE public.imported_documents ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_imported_docs_updated_at ON public.imported_documents;
CREATE TRIGGER set_imported_docs_updated_at
  BEFORE UPDATE ON public.imported_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 4. EXTERNAL DISCUSSIONS TABLE (GitHub PRs/Issues & Slack Messages)
-- Stores synced communication entities linked to company projects and pages.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.external_discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('github', 'slack', 'google_meet')),
  external_id text NOT NULL,
  external_thread_id text,
  channel_or_repo text NOT NULL,
  title text,
  body text,
  author_name text,
  author_avatar text,
  external_url text,
  linked_project_id uuid REFERENCES public.company_entities(id) ON DELETE SET NULL,
  linked_page_id uuid REFERENCES public.pages(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_external_discussions_source UNIQUE (organization_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_external_discussions_org_provider 
  ON public.external_discussions (organization_id, provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_discussions_channel_repo 
  ON public.external_discussions (organization_id, channel_or_repo);

ALTER TABLE public.external_discussions ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_external_discussions_updated_at ON public.external_discussions;
CREATE TRIGGER set_external_discussions_updated_at
  BEFORE UPDATE ON public.external_discussions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY POLICIES
-- ------------------------------------------------------------------------------

-- 5.1. Integration Sync Logs
DROP POLICY IF EXISTS "Members can view sync logs" ON public.integration_sync_logs;
CREATE POLICY "Members can view sync logs"
  ON public.integration_sync_logs
  FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Admins can manage sync logs" ON public.integration_sync_logs;
CREATE POLICY "Admins can manage sync logs"
  ON public.integration_sync_logs
  FOR ALL
  USING (public.has_org_role(organization_id, array['owner', 'admin']))
  WITH CHECK (public.has_org_role(organization_id, array['owner', 'admin']));

-- 5.2. Organization API Keys (Admins/Owners only)
DROP POLICY IF EXISTS "Owners and admins can view API keys" ON public.organization_api_keys;
CREATE POLICY "Owners and admins can view API keys"
  ON public.organization_api_keys
  FOR SELECT
  USING (public.has_org_role(organization_id, array['owner', 'admin']));

DROP POLICY IF EXISTS "Owners and admins can manage API keys" ON public.organization_api_keys;
CREATE POLICY "Owners and admins can manage API keys"
  ON public.organization_api_keys
  FOR ALL
  USING (public.has_org_role(organization_id, array['owner', 'admin']))
  WITH CHECK (public.has_org_role(organization_id, array['owner', 'admin']));

-- 5.3. Imported Documents
DROP POLICY IF EXISTS "Members can view imported documents" ON public.imported_documents;
CREATE POLICY "Members can view imported documents"
  ON public.imported_documents
  FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Admins can manage imported documents" ON public.imported_documents;
CREATE POLICY "Admins can manage imported documents"
  ON public.imported_documents
  FOR ALL
  USING (public.has_org_role(organization_id, array['owner', 'admin']))
  WITH CHECK (public.has_org_role(organization_id, array['owner', 'admin']));

-- 5.4. External Discussions
DROP POLICY IF EXISTS "Members can view external discussions" ON public.external_discussions;
CREATE POLICY "Members can view external discussions"
  ON public.external_discussions
  FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Admins can manage external discussions" ON public.external_discussions;
CREATE POLICY "Admins can manage external discussions"
  ON public.external_discussions
  FOR ALL
  USING (public.has_org_role(organization_id, array['owner', 'admin']))
  WITH CHECK (public.has_org_role(organization_id, array['owner', 'admin']));

-- ------------------------------------------------------------------------------
-- 6. SECURITY DEFINER RPC: VALIDATE API KEY
-- Authenticates incoming public API requests without exposing raw secrets.
-- Updates last_used_at timestamp atomically.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_api_key(
  p_key_hash text
)
RETURNS TABLE (
  valid boolean,
  key_id uuid,
  organization_id uuid,
  organization_name text,
  scopes text[],
  rate_limit_per_minute integer,
  error_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec record;
BEGIN
  IF p_key_hash IS NULL OR length(p_key_hash) != 64 THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::text[], NULL::integer, 'invalid_key_format'::text;
    RETURN;
  END IF;

  SELECT 
    k.id AS key_id,
    k.organization_id,
    o.name AS org_name,
    k.scopes,
    k.rate_limit_per_minute,
    k.expires_at,
    k.revoked_at
  INTO v_rec
  FROM public.organization_api_keys k
  JOIN public.organizations o ON o.id = k.organization_id
  WHERE k.key_hash = p_key_hash
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::text[], NULL::integer, 'key_not_found'::text;
    RETURN;
  END IF;

  IF v_rec.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::text[], NULL::integer, 'key_revoked'::text;
    RETURN;
  END IF;

  IF v_rec.expires_at IS NOT NULL AND v_rec.expires_at <= now() THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, NULL::text[], NULL::integer, 'key_expired'::text;
    RETURN;
  END IF;

  -- Update last_used_at asynchronously/best effort
  UPDATE public.organization_api_keys
  SET last_used_at = now()
  WHERE id = v_rec.key_id;

  RETURN QUERY SELECT 
    true, 
    v_rec.key_id, 
    v_rec.organization_id, 
    v_rec.org_name, 
    v_rec.scopes, 
    v_rec.rate_limit_per_minute, 
    NULL::text;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. EXPLICIT PRIVILEGES (Compliance with Migration 00034)
-- ------------------------------------------------------------------------------

REVOKE ALL ON TABLE public.integration_sync_logs FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.integration_sync_logs TO authenticated;
GRANT ALL ON TABLE public.integration_sync_logs TO service_role;

REVOKE ALL ON TABLE public.organization_api_keys FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_api_keys TO authenticated;
GRANT ALL ON TABLE public.organization_api_keys TO service_role;

REVOKE ALL ON TABLE public.imported_documents FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.imported_documents TO authenticated;
GRANT ALL ON TABLE public.imported_documents TO service_role;

REVOKE ALL ON TABLE public.external_discussions FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.external_discussions TO authenticated;
GRANT ALL ON TABLE public.external_discussions TO service_role;

REVOKE EXECUTE ON FUNCTION public.validate_api_key(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_api_key(text) TO service_role;

COMMIT;
