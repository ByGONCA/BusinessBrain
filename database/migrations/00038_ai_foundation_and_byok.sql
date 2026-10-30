-- ==============================================================================
-- Company Brain: Phase AI Foundation, BYOK Credentials & Conversation Ledger
-- Migration: 00038_ai_foundation_and_byok.sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. ORGANIZATION AI CREDENTIALS TABLE (BYOK)
-- Encrypted storage for organization-managed AI provider API keys.
-- Plaintext credentials are NEVER persisted to disk.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organization_ai_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('gemini', 'openai', 'qwen', 'custom_openai_compatible')),
  label text NOT NULL CHECK (length(trim(label)) > 0 AND length(label) <= 80),
  key_prefix text NOT NULL CHECK (length(key_prefix) >= 4),
  encrypted_api_key text NOT NULL,                          -- AES-256-GCM format: ivHex:authTagHex:ciphertextHex
  key_fingerprint text NOT NULL,                            -- HMAC-SHA256 fingerprint for deduplication
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invalid', 'quota_exceeded', 'revoked')),
  is_default boolean NOT NULL DEFAULT false,
  custom_base_url text,                                     -- For private vLLM or custom OpenAI-compatible endpoints
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_tested_at timestamptz,
  last_used_at timestamptz,
  last_error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_org_ai_cred_fingerprint UNIQUE (organization_id, provider, key_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_ai_credentials_org 
  ON public.organization_ai_credentials (organization_id);

CREATE INDEX IF NOT EXISTS idx_ai_credentials_status 
  ON public.organization_ai_credentials (organization_id, provider, status);

ALTER TABLE public.organization_ai_credentials ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_org_ai_credentials_updated_at ON public.organization_ai_credentials;
CREATE TRIGGER set_org_ai_credentials_updated_at
  BEFORE UPDATE ON public.organization_ai_credentials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2. AI CONVERSATIONS TABLE
-- Persistent conversational sessions scoped strictly per organization and user.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nova Discussão' CHECK (length(trim(title)) > 0 AND length(title) <= 200),
  provider text NOT NULL DEFAULT 'gemini',
  model text NOT NULL DEFAULT 'gemini-2.5-flash',
  is_byok boolean NOT NULL DEFAULT false,
  credential_id uuid REFERENCES public.organization_ai_credentials(id) ON DELETE SET NULL,
  context_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_org_user 
  ON public.ai_conversations (organization_id, user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_org 
  ON public.ai_conversations (organization_id);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER set_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. AI MESSAGES TABLE
-- Individual conversational turns, streaming token counts, and verified source citations.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  tokens_prompt integer NOT NULL DEFAULT 0 CHECK (tokens_prompt >= 0),
  tokens_completion integer NOT NULL DEFAULT 0 CHECK (tokens_completion >= 0),
  execution_duration_ms integer CHECK (execution_duration_ms IS NULL OR execution_duration_ms >= 0),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation 
  ON public.ai_messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_ai_messages_org 
  ON public.ai_messages (organization_id);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 4. AI USAGE LEDGER TABLE
-- Audit trail of token consumption, cost estimates, and quota management.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_usage_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text NOT NULL,
  is_byok boolean NOT NULL DEFAULT false,
  prompt_tokens integer NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens integer NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  estimated_cost_usd numeric(10, 6) NOT NULL DEFAULT 0.000000 CHECK (estimated_cost_usd >= 0),
  status text NOT NULL CHECK (status IN ('success', 'failed', 'canceled', 'rate_limited')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_org_created 
  ON public.ai_usage_ledger (organization_id, created_at DESC);

ALTER TABLE public.ai_usage_ledger ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict multi-tenant isolation enforcing membership and role-based boundaries.
-- ------------------------------------------------------------------------------

-- 5.1 Credenciais AI (Owners e Admins gerem; utilizadores comuns não acedem)
DROP POLICY IF EXISTS "Owners and admins can manage AI credentials" ON public.organization_ai_credentials;
CREATE POLICY "Owners and admins can manage AI credentials"
  ON public.organization_ai_credentials
  FOR ALL
  USING (public.has_org_role(organization_id, array['owner', 'admin']))
  WITH CHECK (public.has_org_role(organization_id, array['owner', 'admin']));

-- 5.2 Conversas de IA (Membros da organização acedem e gerem as suas próprias conversas)
DROP POLICY IF EXISTS "Users can manage own conversations in org" ON public.ai_conversations;
CREATE POLICY "Users can manage own conversations in org"
  ON public.ai_conversations
  FOR ALL
  USING (public.is_org_member(organization_id) AND user_id = auth.uid())
  WITH CHECK (public.is_org_member(organization_id) AND user_id = auth.uid());

-- 5.3 Mensagens de IA (Acedidas apenas pelo autor da conversa dentro da organização)
DROP POLICY IF EXISTS "Users can access messages of own conversations" ON public.ai_messages;
CREATE POLICY "Users can access messages of own conversations"
  ON public.ai_messages
  FOR ALL
  USING (
    public.is_org_member(organization_id) AND EXISTS (
      SELECT 1 FROM public.ai_conversations c 
      WHERE c.id = ai_messages.conversation_id 
        AND c.user_id = auth.uid()
        AND c.organization_id = ai_messages.organization_id
    )
  )
  WITH CHECK (
    public.is_org_member(organization_id) AND EXISTS (
      SELECT 1 FROM public.ai_conversations c 
      WHERE c.id = ai_messages.conversation_id 
        AND c.user_id = auth.uid()
        AND c.organization_id = ai_messages.organization_id
    )
  );

-- 5.4 Ledger de Consumo (Membros podem consultar o consumo agregado da organização)
DROP POLICY IF EXISTS "Members can view org AI usage summary" ON public.ai_usage_ledger;
CREATE POLICY "Members can view org AI usage summary"
  ON public.ai_usage_ledger
  FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Service role and members can insert usage logs" ON public.ai_usage_ledger;
CREATE POLICY "Members can insert usage logs in org"
  ON public.ai_usage_ledger
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

-- ------------------------------------------------------------------------------
-- 6. EXPLICIT PRIVILEGES (Compliance with Migration 00034)
-- ------------------------------------------------------------------------------

REVOKE ALL ON TABLE public.organization_ai_credentials FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_ai_credentials TO authenticated;
GRANT ALL ON TABLE public.organization_ai_credentials TO service_role;

REVOKE ALL ON TABLE public.ai_conversations FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_conversations TO authenticated;
GRANT ALL ON TABLE public.ai_conversations TO service_role;

REVOKE ALL ON TABLE public.ai_messages FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_messages TO authenticated;
GRANT ALL ON TABLE public.ai_messages TO service_role;

REVOKE ALL ON TABLE public.ai_usage_ledger FROM public, anon;
GRANT SELECT, INSERT ON TABLE public.ai_usage_ledger TO authenticated;
GRANT ALL ON TABLE public.ai_usage_ledger TO service_role;

COMMIT;
