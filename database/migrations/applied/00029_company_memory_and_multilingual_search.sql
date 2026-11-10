-- ==============================================================================
-- Company Brain: Knowledge & Company Memory Foundation
-- Migration: 00029_company_memory_and_multilingual_search.sql
-- Description: Adds monotonic revision tracking (OCC), automated revision integrity
--              trigger, 100% non-destructive history deduplication, transactional
--              save & restore RPCs, and multilingual unaccent search indexes.
--
-- Rollback Plan:
-- 1. DROP TRIGGER IF EXISTS trg_pages_increment_revision ON public.pages;
-- 2. DROP FUNCTION IF EXISTS public.auto_increment_page_revision();
-- 3. DROP FUNCTION IF EXISTS public.save_page_content(uuid, bigint, text, text, uuid, jsonb, text);
-- 4. DROP FUNCTION IF EXISTS public.restore_page_version(uuid, uuid);
-- 5. DROP FUNCTION IF EXISTS public.global_workspace_search(text, integer);
-- 6. DROP INDEX IF EXISTS idx_pages_multilingual_search;
-- 7. DROP INDEX IF EXISTS idx_company_entities_multilingual_search;
-- 8. DROP INDEX IF EXISTS uq_page_versions_page_version;
-- 9. (Note: Only after application code is reverted) ALTER TABLE public.pages DROP COLUMN IF EXISTS revision_id;
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD MONOTONIC REVISION_ID COLUMN TO PAGES
-- ------------------------------------------------------------------------------
ALTER TABLE public.pages 
  ADD COLUMN IF NOT EXISTS revision_id bigint NOT NULL DEFAULT 1;

-- ------------------------------------------------------------------------------
-- 2. AUTOMATIC REVISION INTEGRITY TRIGGER (Condition 4.2)
-- Automatically increments revision_id when content or title changes and the caller
-- did NOT explicitly update revision_id. Prevents stale writes from legacy paths
-- or rolling deployments from silently overwriting active editor sessions.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_increment_page_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If content, title, or content_text changed AND revision_id was not explicitly incremented:
  IF (NEW.content IS DISTINCT FROM OLD.content 
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.content_text IS DISTINCT FROM OLD.content_text)
     AND NEW.revision_id IS NOT DISTINCT FROM OLD.revision_id THEN
    NEW.revision_id := OLD.revision_id + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pages_increment_revision ON public.pages;
CREATE TRIGGER trg_pages_increment_revision
  BEFORE UPDATE ON public.pages
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_increment_page_revision();

-- ------------------------------------------------------------------------------
-- 3. 100% NON-DESTRUCTIVE DEDUPLICATION PRE-CHECK & UNIQUE INDEX
-- Aborts migration transaction if duplicate version numbers exist.
-- Zero deletes or alterations to historical records.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.page_versions
    GROUP BY page_id, version_number
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Abortando migracao 00029: existem duplicados preexistentes em page_versions. Requer auditoria manual nao-destrutiva.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_page_versions_page_version
  ON public.page_versions (page_id, version_number);

-- ------------------------------------------------------------------------------
-- 4. MULTILINGUAL UNACCENT & SANITIZATION FUNCTIONS
-- Covers Western European Latin scripts (PT, ES, FR, DE, EN).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.immutable_unaccent(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
SET search_path = public, pg_temp
AS $$
  SELECT lower(translate(
    input_text,
    'áàâãäåāăąÁÀÂÃÄÅĀĂĄéèêëēĕėęěÉÈÊËĒĔĖĘĚíìîïīĭįÍÌÎÏĪĬĮóòôõöøōŏőÓÒÔÕÖØŌŎŐúùûüũūŭůűųÚÙÛÜŨŪŬŮŰŲçćčĉċÇĆČĈĊñńňņÑŃŇŅýÿŷÝŸŶšśŝşșŠŚŜŞȘžźżŽŹŻřŕŘŔďđĎĐťțţŤȚŢ',
    'aaaaaaaaaAAAAAAAAAeeeeeeeeeEEEEEEEEEiiiiiiiIIIIIIIoooooooooOOOOOOOOOuuuuuuuuuuUUUUUUUUUUcccccCCCCCnnnnNNNNyyyYYYsssssSSSSSzzzZZZrrRRddDDtttTTT'
  ));
$$;

CREATE OR REPLACE FUNCTION public.sanitize_tsquery_input(raw_query text)
RETURNS tsquery
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
DECLARE
  cleaned text;
  term text;
  terms text[];
  sanitized_query text := '';
BEGIN
  IF raw_query IS NULL OR trim(raw_query) = '' THEN
    RETURN to_tsquery('simple', '');
  END IF;

  cleaned := public.immutable_unaccent(raw_query);
  cleaned := regexp_replace(cleaned, '[^a-z0-9 ]+', ' ', 'g');
  terms := string_to_array(trim(regexp_replace(cleaned, '\s+', ' ', 'g')), ' ');

  IF terms IS NULL OR array_length(terms, 1) IS NULL OR terms = ARRAY[''] THEN
    RETURN to_tsquery('simple', '');
  END IF;

  FOREACH term IN ARRAY terms[1:10] LOOP
    IF length(term) >= 2 THEN
      IF sanitized_query <> '' THEN
        sanitized_query := sanitized_query || ' & ';
      END IF;
      sanitized_query := sanitized_query || term || ':*';
    END IF;
  END LOOP;

  IF sanitized_query = '' THEN
    RETURN to_tsquery('simple', '');
  END IF;

  RETURN to_tsquery('simple', sanitized_query);
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. FUNCTIONAL GIN SEARCH INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pages_multilingual_search
  ON public.pages USING gin (
    to_tsvector('simple', public.immutable_unaccent(coalesce(title, '') || ' ' || coalesce(content_text, '')))
  );

CREATE INDEX IF NOT EXISTS idx_company_entities_multilingual_search
  ON public.company_entities USING gin (
    to_tsvector('simple', public.immutable_unaccent(coalesce(title, '') || ' ' || coalesce(content, '')))
  );

-- ------------------------------------------------------------------------------
-- 6. TRANSACTIONAL OCC SAVE RPC (save_page_content)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_page_content(
  p_page_id uuid,
  p_expected_revision bigint,
  p_title text DEFAULT NULL,
  p_icon text DEFAULT NULL,
  p_icon_file_id uuid DEFAULT NULL,
  p_content jsonb DEFAULT '[]'::jsonb,
  p_content_text text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_current_revision bigint;
  v_next_revision bigint;
  v_now timestamptz := now();
  v_five_minutes_ago timestamptz;
  v_has_recent_activity boolean;
  v_latest_version integer;
  v_can_edit boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_expected_revision IS NULL THEN
    RAISE EXCEPTION 'MISSING_OCC_TOKEN: p_expected_revision is required' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Acquire exclusive lock on target page row
  SELECT organization_id, revision_id
  INTO v_org_id, v_current_revision
  FROM public.pages
  WHERE id = p_page_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Page does not exist' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Verify organization membership & permission
  v_can_edit := public.has_permission(v_org_id, 'pages.edit');
  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'FORBIDDEN: You do not have permission to edit pages' USING ERRCODE = '42501';
  END IF;

  -- 3. Validate OCC token
  IF v_current_revision <> p_expected_revision THEN
    RAISE EXCEPTION 'STALE_WRITE: Page revision mismatch. Expected %, got %', p_expected_revision, v_current_revision
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Calculate next revision
  v_next_revision := v_current_revision + 1;

  -- 5. Update page content
  UPDATE public.pages
  SET title = coalesce(p_title, title),
      icon = coalesce(p_icon, icon),
      icon_file_id = CASE WHEN p_icon_file_id IS NOT NULL THEN p_icon_file_id ELSE icon_file_id END,
      content = p_content,
      content_text = p_content_text,
      revision_id = v_next_revision,
      last_edited_by = v_user_id,
      updated_at = v_now
  WHERE id = p_page_id;

  -- 6. Snapshot & Activity (throttled: at most once every 5 minutes per user)
  v_five_minutes_ago := v_now - interval '5 minutes';
  
  SELECT EXISTS (
    SELECT 1 FROM public.page_activity
    WHERE page_id = p_page_id
      AND actor_id = v_user_id
      AND action = 'content_edited'
      AND created_at >= v_five_minutes_ago
  ) INTO v_has_recent_activity;

  IF NOT v_has_recent_activity THEN
    -- Get next version number
    SELECT coalesce(max(version_number), 0) + 1
    INTO v_latest_version
    FROM public.page_versions
    WHERE page_id = p_page_id;

    -- Insert snapshot
    INSERT INTO public.page_versions (
      organization_id,
      page_id,
      version_number,
      title,
      content,
      content_text,
      created_by,
      created_at
    ) VALUES (
      v_org_id,
      p_page_id,
      v_latest_version,
      coalesce(p_title, 'Untitled'),
      p_content,
      p_content_text,
      v_user_id,
      v_now
    );

    -- Insert activity
    INSERT INTO public.page_activity (
      organization_id,
      page_id,
      actor_id,
      action,
      metadata,
      created_at
    ) VALUES (
      v_org_id,
      p_page_id,
      v_user_id,
      'content_edited',
      jsonb_build_object('version_number', v_latest_version, 'revision_id', v_next_revision),
      v_now
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'revision_id', v_next_revision,
    'page_id', p_page_id
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. TRANSACTIONAL VERSION RESTORE RPC (restore_page_version)
-- Restores page content and increments revision_id, invalidating in-flight autosaves.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_page_version(
  p_page_id uuid,
  p_version_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_current_revision bigint;
  v_next_revision bigint;
  v_now timestamptz := now();
  v_version_record record;
  v_can_edit boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated' USING ERRCODE = '42501';
  END IF;

  -- 1. Lock page row
  SELECT organization_id, revision_id
  INTO v_org_id, v_current_revision
  FROM public.pages
  WHERE id = p_page_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Page does not exist' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Check permission
  v_can_edit := public.has_permission(v_org_id, 'pages.edit');
  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'FORBIDDEN: You do not have permission to edit pages' USING ERRCODE = '42501';
  END IF;

  -- 3. Fetch version record
  SELECT title, content, content_text, version_number
  INTO v_version_record
  FROM public.page_versions
  WHERE id = p_version_id
    AND page_id = p_page_id
    AND organization_id = v_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERSION_NOT_FOUND: Target version record does not exist' USING ERRCODE = 'P0002';
  END IF;

  -- 4. Monotonic increment of revision_id
  v_next_revision := v_current_revision + 1;

  -- 5. Restore content to page
  UPDATE public.pages
  SET title = v_version_record.title,
      content = v_version_record.content,
      content_text = v_version_record.content_text,
      revision_id = v_next_revision,
      last_edited_by = v_user_id,
      updated_at = v_now
  WHERE id = p_page_id;

  -- 6. Log restoration activity
  INSERT INTO public.page_activity (
    organization_id,
    page_id,
    actor_id,
    action,
    metadata,
    created_at
  ) VALUES (
    v_org_id,
    p_page_id,
    v_user_id,
    'version_restored',
    jsonb_build_object(
      'restored_version_number', v_version_record.version_number,
      'version_id', p_version_id,
      'new_revision_id', v_next_revision
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'revision_id', v_next_revision,
    'page_id', p_page_id,
    'title', v_version_record.title,
    'content', v_version_record.content
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. UNIFIED GLOBAL WORKSPACE SEARCH RPC (global_workspace_search)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.global_workspace_search(
  p_query text,
  p_limit integer DEFAULT 20,
  p_organization_id uuid DEFAULT NULL
)
RETURNS TABLE (
  result_id uuid,
  result_type text,
  title text,
  snippet text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_tsquery tsquery;
  v_can_view_pages boolean;
  v_can_view_brain boolean;
  v_clamped_limit integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated' USING ERRCODE = '42501';
  END IF;

  -- Resolve organization: explicit p_organization_id or fall back to user's first org
  IF p_organization_id IS NOT NULL THEN
    -- Strictly verify caller is an active member of the requested organization
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = v_user_id AND organization_id = p_organization_id
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: User is not a member of the requested organization' USING ERRCODE = '42501';
    END IF;
    v_org_id := p_organization_id;
  ELSE
    SELECT organization_id INTO v_org_id
    FROM public.organization_members
    WHERE user_id = v_user_id
    LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  v_clamped_limit := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_tsquery := public.sanitize_tsquery_input(p_query);

  IF v_tsquery = to_tsquery('simple', '') THEN
    RETURN;
  END IF;

  v_can_view_pages := public.has_permission(v_org_id, 'pages.view');
  v_can_view_brain := public.has_permission(v_org_id, 'brain.view');

  RETURN QUERY
  WITH search_union AS (
    -- 1. Pages Search (if permitted)
    SELECT 
      p.id AS res_id,
      'page'::text AS res_type,
      p.title AS res_title,
      substring(p.content_text FROM 1 FOR 200) AS res_snippet,
      p.updated_at AS res_updated_at,
      ts_rank(
        to_tsvector('simple', public.immutable_unaccent(coalesce(p.title, '') || ' ' || coalesce(p.content_text, ''))),
        v_tsquery
      ) AS rank
    FROM public.pages p
    WHERE v_can_view_pages
      AND p.organization_id = v_org_id
      AND p.is_archived = false
      AND to_tsvector('simple', public.immutable_unaccent(coalesce(p.title, '') || ' ' || coalesce(p.content_text, ''))) @@ v_tsquery

    UNION ALL

    -- 2. Company Entities Search (if permitted)
    SELECT 
      e.id AS res_id,
      e.type::text AS res_type,
      e.title AS res_title,
      substring(e.content FROM 1 FOR 200) AS res_snippet,
      e.updated_at AS res_updated_at,
      ts_rank(
        to_tsvector('simple', public.immutable_unaccent(coalesce(e.title, '') || ' ' || coalesce(e.content, ''))),
        v_tsquery
      ) AS rank
    FROM public.company_entities e
    WHERE v_can_view_brain
      AND e.organization_id = v_org_id
      AND to_tsvector('simple', public.immutable_unaccent(coalesce(e.title, '') || ' ' || coalesce(e.content, ''))) @@ v_tsquery
  )
  SELECT 
    search_union.res_id,
    search_union.res_type,
    search_union.res_title,
    search_union.res_snippet,
    search_union.res_updated_at
  FROM search_union
  ORDER BY search_union.rank DESC, search_union.res_updated_at DESC
  LIMIT v_clamped_limit;
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. PRIVILEGES AND GRANTS HARDENING
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.save_page_content FROM public;
GRANT EXECUTE ON FUNCTION public.save_page_content TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.restore_page_version FROM public;
GRANT EXECUTE ON FUNCTION public.restore_page_version TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.global_workspace_search FROM public;
GRANT EXECUTE ON FUNCTION public.global_workspace_search TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.immutable_unaccent FROM public;
GRANT EXECUTE ON FUNCTION public.immutable_unaccent TO authenticated, service_role, anon;

REVOKE ALL ON FUNCTION public.sanitize_tsquery_input FROM public;
GRANT EXECUTE ON FUNCTION public.sanitize_tsquery_input TO authenticated, service_role, anon;

NOTIFY pgrst, 'reload schema';
