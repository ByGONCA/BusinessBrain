-- ==============================================================================
-- Migration: 00041_ai_credit_reservations.sql
-- Two-Phase Atomic Credit Reservation Engine & Concurrency Control for AI
-- ==============================================================================

BEGIN;

-- 1. Create public.ai_credit_reservations table
CREATE TABLE IF NOT EXISTS public.ai_credit_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  task_type text NOT NULL DEFAULT 'general_chat' 
    CHECK (task_type IN ('general_chat', 'business_analysis', 'financial_analysis', 'document_analysis', 'page_generation', 'complex_reasoning')),
  provider text NOT NULL,
  model text NOT NULL,
  is_byok boolean NOT NULL DEFAULT false,
  reserved_credits integer NOT NULL DEFAULT 0,
  settled_credits integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'reserved' 
    CHECK (status IN ('reserved', 'settled', 'released', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- 2. Performance indexes for concurrent reservation lookups
CREATE INDEX IF NOT EXISTS idx_ai_credit_reservations_org_status 
  ON public.ai_credit_reservations (organization_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_ai_credit_reservations_user_status 
  ON public.ai_credit_reservations (user_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_credit_reservations_expires 
  ON public.ai_credit_reservations (expires_at) 
  WHERE status = 'reserved';

-- 3. Row Level Security
ALTER TABLE public.ai_credit_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_reservations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view org AI reservations" ON public.ai_credit_reservations;
CREATE POLICY "Members can view org AI reservations"
  ON public.ai_credit_reservations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_credit_reservations TO authenticated;
GRANT ALL ON TABLE public.ai_credit_reservations TO service_role;

-- 4. Atomic PostgreSQL RPC for Two-Phase Credit Reservation
CREATE OR REPLACE FUNCTION public.reserve_ai_credits_atomic(
  p_org_id uuid,
  p_user_id uuid,
  p_conversation_id uuid,
  p_task_type text,
  p_provider text,
  p_model text,
  p_is_byok boolean,
  p_estimated_credits integer,
  p_quota integer
) RETURNS TABLE (
  allowed boolean,
  reservation_id uuid,
  used_credits integer,
  reserved_credits integer,
  quota integer,
  error_code text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_start_of_month timestamptz := date_trunc('month', now());
  v_used_tokens bigint := 0;
  v_used_credits integer := 0;
  v_active_reserved_credits integer := 0;
  v_new_reservation_id uuid;
  v_active_concurrent_count integer := 0;
BEGIN
  -- 0. Acquire row lock on organization to serialize concurrent reservations per tenant
  PERFORM id FROM public.organizations WHERE id = p_org_id FOR UPDATE;

  -- 1. Expire any stale reservations for this organization past their TTL
  UPDATE public.ai_credit_reservations
  SET status = 'expired'
  WHERE organization_id = p_org_id
    AND status = 'reserved'
    AND expires_at < now();

  -- 2. Concurrency limit check: max 10 concurrent in-flight requests per organization
  SELECT count(*) INTO v_active_concurrent_count
  FROM public.ai_credit_reservations
  WHERE organization_id = p_org_id
    AND status = 'reserved'
    AND expires_at >= now();

  IF v_active_concurrent_count >= 10 THEN
    RETURN QUERY SELECT 
      false, 
      NULL::uuid, 
      0, 
      0, 
      p_quota, 
      'CONCURRENCY_LIMIT_REACHED'::text;
    RETURN;
  END IF;

  -- 3. BYOK Requests consume $0.00 platform credits, but record concurrency
  IF p_is_byok THEN
    INSERT INTO public.ai_credit_reservations (
      organization_id,
      user_id,
      conversation_id,
      task_type,
      provider,
      model,
      is_byok,
      reserved_credits,
      status,
      expires_at
    ) VALUES (
      p_org_id,
      p_user_id,
      p_conversation_id,
      p_task_type,
      p_provider,
      p_model,
      true,
      0,
      'reserved',
      now() + interval '5 minutes'
    ) RETURNING id INTO v_new_reservation_id;

    RETURN QUERY SELECT 
      true, 
      v_new_reservation_id, 
      0, 
      0, 
      p_quota, 
      NULL::text;
    RETURN;
  END IF;

  -- 4. Calculate actual tokens used this month from ai_usage_ledger
  SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0)
  INTO v_used_tokens
  FROM public.ai_usage_ledger
  WHERE organization_id = p_org_id
    AND status IN ('success', 'canceled')
    AND is_byok = false
    AND created_at >= v_start_of_month;

  v_used_credits := FLOOR(v_used_tokens / 1000)::integer;

  -- 5. Calculate credits locked in currently active reservations
  SELECT COALESCE(SUM(ai_credit_reservations.reserved_credits), 0)
  INTO v_active_reserved_credits
  FROM public.ai_credit_reservations
  WHERE organization_id = p_org_id
    AND status = 'reserved'
    AND is_byok = false
    AND expires_at >= now();

  -- 6. Check if quota would be breached
  IF (v_used_credits + v_active_reserved_credits + p_estimated_credits) > p_quota THEN
    RETURN QUERY SELECT 
      false, 
      NULL::uuid, 
      v_used_credits, 
      v_active_reserved_credits, 
      p_quota, 
      'QUOTA_EXHAUSTED'::text;
    RETURN;
  END IF;

  -- 7. Quota available: Create the reservation atomically
  INSERT INTO public.ai_credit_reservations (
    organization_id,
    user_id,
    conversation_id,
    task_type,
    provider,
    model,
    is_byok,
    reserved_credits,
    status,
    expires_at
  ) VALUES (
    p_org_id,
    p_user_id,
    p_conversation_id,
    p_task_type,
    p_provider,
    p_model,
    false,
    p_estimated_credits,
    'reserved',
    now() + interval '5 minutes'
  ) RETURNING id INTO v_new_reservation_id;

  RETURN QUERY SELECT 
    true, 
    v_new_reservation_id, 
    v_used_credits, 
    (v_active_reserved_credits + p_estimated_credits), 
    p_quota, 
    NULL::text;
  RETURN;
END;
$$;

-- 5. Protected Idempotent Settlement RPC
CREATE OR REPLACE FUNCTION public.settle_ai_credit_reservation_atomic(
  p_reservation_id uuid,
  p_actual_tokens integer,
  p_is_byok boolean,
  p_status text DEFAULT 'settled'
) RETURNS TABLE (
  success boolean,
  settled_credits integer,
  error_code text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_settled_credits integer := 0;
  v_updated_rows integer := 0;
BEGIN
  IF NOT p_is_byok THEN
    v_settled_credits := GREATEST(1, CEIL(p_actual_tokens::numeric / 1000.0)::integer);
  END IF;

  UPDATE public.ai_credit_reservations
  SET settled_credits = v_settled_credits,
      status = 'settled',
      settled_at = now()
  WHERE id = p_reservation_id
    AND status = 'reserved';

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows = 0 THEN
    RETURN QUERY SELECT false, 0, 'STATE_CONFLICT'::text;
  ELSE
    RETURN QUERY SELECT true, v_settled_credits, NULL::text;
  END IF;
END;
$$;

-- 6. Protected Idempotent Release RPC
CREATE OR REPLACE FUNCTION public.release_ai_credit_reservation_atomic(
  p_reservation_id uuid
) RETURNS TABLE (
  success boolean,
  error_code text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_updated_rows integer := 0;
BEGIN
  UPDATE public.ai_credit_reservations
  SET settled_credits = 0,
      status = 'released',
      settled_at = now()
  WHERE id = p_reservation_id
    AND status = 'reserved';

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows = 0 THEN
    RETURN QUERY SELECT false, 'STATE_CONFLICT'::text;
  ELSE
    RETURN QUERY SELECT true, NULL::text;
  END IF;
END;
$$;

COMMIT;
