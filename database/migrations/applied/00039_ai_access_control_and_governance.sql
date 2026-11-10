-- ==============================================================================
-- Company Brain: Phase AI Data Governance, Source Scoping & Access Control
-- Migration: 00039_ai_access_control_and_governance.sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. AI ACCESS AUTHORIZATIONS TABLE
-- Audit log and active permissions granted to AI for querying specific resources.
-- Guarantees least-privilege, scope expiration, and immediate revocation.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_access_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('once', 'conversation', 'persistent')),
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('area', 'page', 'document', 'finance', 'github', 'brain', 'tool')),
  resource_id text NOT NULL,
  action_type text NOT NULL DEFAULT 'read' CHECK (action_type IN ('read', 'create', 'modify', 'execute')),
  purpose text NOT NULL DEFAULT 'chat_context',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_authorizations_org_user_status 
  ON public.ai_access_authorizations (organization_id, user_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_authorizations_conv_resource 
  ON public.ai_access_authorizations (conversation_id, resource_id);

CREATE INDEX IF NOT EXISTS idx_ai_authorizations_active_lookup 
  ON public.ai_access_authorizations (organization_id, user_id, resource_id, action_type, status);

ALTER TABLE public.ai_access_authorizations ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. EXTEND AI CONVERSATIONS WITH EXPLICIT SOURCE SELECTION
-- Persists the user's explicit context source selection for each conversation.
-- ------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'ai_conversations' 
      AND column_name = 'selected_source_ids'
  ) THEN
    ALTER TABLE public.ai_conversations 
      ADD COLUMN selected_source_ids text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. ROW-LEVEL SECURITY POLICIES: ai_access_authorizations
-- Strict isolation: users access their own grants; admins/owners audit the workspace.
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Members can view own AI authorizations or admins audit org" ON public.ai_access_authorizations;
CREATE POLICY "Members can view own AI authorizations or admins audit org"
  ON public.ai_access_authorizations
  FOR SELECT
  USING (
    public.is_org_member(organization_id)
    AND (
      user_id = auth.uid()
      OR public.has_org_role(organization_id, ARRAY['owner', 'admin'])
    )
  );

DROP POLICY IF EXISTS "Members can grant AI authorizations for themselves" ON public.ai_access_authorizations;
CREATE POLICY "Members can grant AI authorizations for themselves"
  ON public.ai_access_authorizations
  FOR INSERT
  WITH CHECK (
    public.is_org_member(organization_id)
    AND user_id = auth.uid()
    AND granted_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Members or admins can update/revoke AI authorizations" ON public.ai_access_authorizations;
CREATE POLICY "Members or admins can update/revoke AI authorizations"
  ON public.ai_access_authorizations
  FOR UPDATE
  USING (
    public.is_org_member(organization_id)
    AND (
      user_id = auth.uid()
      OR public.has_org_role(organization_id, ARRAY['owner', 'admin'])
    )
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND (
      user_id = auth.uid()
      OR public.has_org_role(organization_id, ARRAY['owner', 'admin'])
    )
  );

-- Hard deletes disabled to preserve audit trail integrity
DROP POLICY IF EXISTS "Deny hard deletion of AI authorizations" ON public.ai_access_authorizations;
CREATE POLICY "Deny hard deletion of AI authorizations"
  ON public.ai_access_authorizations
  FOR DELETE
  USING (false);

-- ------------------------------------------------------------------------------
-- 4. TABLE GRANTS
-- ------------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON public.ai_access_authorizations TO authenticated;

COMMIT;
