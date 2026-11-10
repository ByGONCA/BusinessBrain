-- ==============================================================================
-- Migration: 00040_multimodel_and_personal_accounts.sql
-- Multi-Model AI Engine, Personal BYOK Credentials, and Individual Account Support
-- ==============================================================================

BEGIN;

-- 1. Extend public.organizations to support Personal Workspaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'organizations' 
      AND column_name = 'workspace_type'
  ) THEN
    ALTER TABLE public.organizations 
      ADD COLUMN workspace_type text NOT NULL DEFAULT 'team' 
      CHECK (workspace_type IN ('team', 'personal'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_workspace_type 
  ON public.organizations(workspace_type);

-- 2. Update provider check constraint on organization_ai_credentials to support all modern providers
ALTER TABLE public.organization_ai_credentials 
  DROP CONSTRAINT IF EXISTS organization_ai_credentials_provider_check;

ALTER TABLE public.organization_ai_credentials 
  ADD CONSTRAINT organization_ai_credentials_provider_check 
  CHECK (provider IN ('gemini', 'openai', 'anthropic', 'deepseek', 'mistral', 'qwen', 'openrouter', 'groq', 'custom_openai_compatible'));

-- 3. Create public.user_ai_credentials for Individual / Personal BYOK
CREATE TABLE IF NOT EXISTS public.user_ai_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('gemini', 'openai', 'anthropic', 'deepseek', 'mistral', 'qwen', 'openrouter', 'groq', 'custom_openai_compatible')),
  label text NOT NULL CHECK (length(trim(label)) > 0 AND length(label) <= 80),
  key_prefix text NOT NULL CHECK (length(key_prefix) >= 4),
  encrypted_api_key text NOT NULL,                          -- AES-256-GCM encrypted (iv:tag:ciphertext)
  key_fingerprint text NOT NULL,                            -- HMAC-SHA256 keyed fingerprint for deduplication
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invalid', 'quota_exceeded', 'revoked')),
  is_default boolean NOT NULL DEFAULT false,
  custom_base_url text,
  last_tested_at timestamptz,
  last_used_at timestamptz,
  last_error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_ai_cred_fingerprint UNIQUE (user_id, provider, key_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_user_ai_credentials_lookup 
  ON public.user_ai_credentials (user_id, provider, status);

ALTER TABLE public.user_ai_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ai_credentials FORCE ROW LEVEL SECURITY;

-- 4. RLS for Personal Credentials (Strict User-Level Isolation)
DROP POLICY IF EXISTS "Users can manage own personal AI credentials" ON public.user_ai_credentials;
CREATE POLICY "Users can manage own personal AI credentials"
  ON public.user_ai_credentials
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_ai_credentials TO authenticated;
GRANT ALL ON TABLE public.user_ai_credentials TO service_role;

-- 5. Extend ai_conversations for Personal Credentials
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'ai_conversations' 
      AND column_name = 'user_credential_id'
  ) THEN
    ALTER TABLE public.ai_conversations 
      ADD COLUMN user_credential_id uuid REFERENCES public.user_ai_credentials(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Extend ai_usage_ledger for Multi-Model, Task Types and Caching
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'ai_usage_ledger' 
      AND column_name = 'task_type'
  ) THEN
    ALTER TABLE public.ai_usage_ledger
      ADD COLUMN task_type text NOT NULL DEFAULT 'general_chat'
        CHECK (task_type IN ('general_chat', 'business_analysis', 'financial_analysis', 'document_analysis', 'page_generation', 'complex_reasoning')),
      ADD COLUMN scope text NOT NULL DEFAULT 'org'
        CHECK (scope IN ('personal', 'org')),
      ADD COLUMN cached_prompt_tokens integer NOT NULL DEFAULT 0
        CHECK (cached_prompt_tokens >= 0),
      ADD COLUMN reported_cost_usd numeric(10, 6) DEFAULT NULL
        CHECK (reported_cost_usd IS NULL OR reported_cost_usd >= 0),
      ADD COLUMN billed_cost_usd numeric(10, 6) NOT NULL DEFAULT 0.000000
        CHECK (billed_cost_usd >= 0),
      ADD COLUMN currency text NOT NULL DEFAULT 'USD'
        CHECK (currency IN ('USD', 'EUR')),
      ADD COLUMN retry_count integer NOT NULL DEFAULT 0
        CHECK (retry_count >= 0),
      ADD COLUMN execution_duration_ms integer DEFAULT NULL
        CHECK (execution_duration_ms IS NULL OR execution_duration_ms >= 0),
      ADD COLUMN error_details jsonb DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_usage_ledger_task_org
  ON public.ai_usage_ledger (organization_id, task_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_ledger_byok_cost
  ON public.ai_usage_ledger (organization_id, is_byok, created_at DESC);

-- 7. Trigger for user_ai_credentials updated_at
DROP TRIGGER IF EXISTS set_user_ai_credentials_updated_at ON public.user_ai_credentials;
CREATE TRIGGER set_user_ai_credentials_updated_at
  BEFORE UPDATE ON public.user_ai_credentials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMIT;
