-- ==============================================================================
-- Company Brain: Personal Workspace & Company Workspace Dual Architecture
-- Migration: 00043_personal_and_company_workspaces.sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. EXTEND AI_CONVERSATIONS WITH WORKSPACE_TYPE & HARDENING
-- Denormalizes workspace_type ('personal' | 'company') to prevent IDOR attacks
-- and enforce strict workspace boundary isolation.
-- ------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'ai_conversations' 
      AND column_name = 'workspace_type'
  ) THEN
    ALTER TABLE public.ai_conversations 
      ADD COLUMN workspace_type text NOT NULL DEFAULT 'company' 
      CHECK (workspace_type IN ('company', 'personal'));
  END IF;
END $$;

-- Align existing conversations based on the organization's workspace_type
UPDATE public.ai_conversations c
SET workspace_type = CASE 
  WHEN o.workspace_type = 'personal' THEN 'personal' 
  ELSE 'company' 
END
FROM public.organizations o
WHERE c.organization_id = o.id;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_workspace_type 
  ON public.ai_conversations (organization_id, user_id, workspace_type, updated_at DESC);

-- ------------------------------------------------------------------------------
-- 2. ENSURE OR CREATE PERSONAL WORKSPACE FUNCTION (IDEMPOTENT)
-- Automatically provisions an individual isolated workspace for a user.
-- Guarantees the user owns 100% of their personal space with role 'owner'.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_personal_workspace(
  p_user_id uuid,
  p_user_name text DEFAULT NULL
)
RETURNS TABLE (
  organization_id uuid,
  name text,
  slug text,
  workspace_type text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid;
  v_org_name text;
  v_org_slug text;
BEGIN
  -- 1. Check if personal workspace already exists for this user
  SELECT o.id, o.name, o.slug
  INTO v_org_id, v_org_name, v_org_slug
  FROM public.organizations o
  JOIN public.organization_members m ON o.id = m.organization_id
  WHERE m.user_id = p_user_id 
    AND o.workspace_type = 'personal'
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    RETURN QUERY
    SELECT v_org_id, v_org_name, v_org_slug, 'personal'::text, 'owner'::text;
    RETURN;
  END IF;

  -- 2. Construct personal workspace attributes
  v_org_name := COALESCE(NULLIF(trim(p_user_name), ''), 'Espaço Pessoal');
  v_org_slug := 'personal-' || substr(p_user_id::text, 1, 8) || '-' || substr(md5(random()::text), 1, 6);

  -- 3. Create the personal organization
  INSERT INTO public.organizations (
    name,
    slug,
    workspace_type,
    created_by,
    status
  ) VALUES (
    v_org_name,
    v_org_slug,
    'personal',
    p_user_id,
    'active'
  )
  RETURNING id INTO v_org_id;

  -- 4. Assign the user as exclusive owner of their personal workspace
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role
  ) VALUES (
    v_org_id,
    p_user_id,
    'owner'
  )
  ON CONFLICT DO NOTHING;

  -- 5. Provision individual baseline subscription for personal workspace
  INSERT INTO public.subscriptions (
    organization_id,
    plan,
    status,
    trial_start,
    trial_end,
    current_period_start,
    current_period_end
  ) VALUES (
    v_org_id,
    'starter',
    'active',
    now(),
    now() + interval '30 days',
    now(),
    now() + interval '30 days'
  )
  ON CONFLICT DO NOTHING;

  RETURN QUERY
  SELECT v_org_id, v_org_name, v_org_slug, 'personal'::text, 'owner'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_personal_workspace(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_personal_workspace(uuid, text) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. RLS HARDENING: PREVENT CROSS-WORKSPACE DATA LEAKAGE
-- Company admins can NEVER read personal conversations of other users.
-- ------------------------------------------------------------------------------

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages FORCE ROW LEVEL SECURITY;

-- ai_conversations RLS
DROP POLICY IF EXISTS "ai_conversations_workspace_isolation" ON public.ai_conversations;
CREATE POLICY "ai_conversations_workspace_isolation"
  ON public.ai_conversations
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid() 
    AND is_org_member(organization_id)
  )
  WITH CHECK (
    user_id = auth.uid() 
    AND is_org_member(organization_id)
  );

-- ai_messages RLS
DROP POLICY IF EXISTS "ai_messages_workspace_isolation" ON public.ai_messages;
CREATE POLICY "ai_messages_workspace_isolation"
  ON public.ai_messages
  FOR ALL
  TO authenticated
  USING (
    is_org_member(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c 
      WHERE c.id = ai_messages.conversation_id 
        AND c.user_id = auth.uid()
        AND c.organization_id = ai_messages.organization_id
    )
  )
  WITH CHECK (
    is_org_member(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c 
      WHERE c.id = ai_messages.conversation_id 
        AND c.user_id = auth.uid()
        AND c.organization_id = ai_messages.organization_id
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_messages TO authenticated;

COMMIT;
