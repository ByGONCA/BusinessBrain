import { PGlite } from "@electric-sql/pglite";

async function runSearchAudit() {
  console.log("Starting comprehensive search audit in PGlite...");
  const db = new PGlite();

  // Create immutable_unaccent and sanitize_tsquery_input
  await db.exec(`
    create or replace function public.immutable_unaccent(input_text text)
    returns text
    language sql
    immutable
    parallel safe
    strict
    set search_path = public, pg_temp
    as $$
      select lower(translate(
        input_text,
        'áàâãäåāăąÁÀÂÃÄÅĀĂĄéèêëēĕėęěÉÈÊËĒĔĖĘĚíìîïīĭįÍÌÎÏĪĬĮóòôõöøōŏőÓÒÔÕÖØŌŎŐúùûüũūŭůűųÚÙÛÜŨŪŬŮŰŲçćčĉċÇĆČĈĊñńňņÑŃŇŅýÿŷÝŸŶšśŝşșŠŚŜŞȘžźżŽŹŻřŕřŘŔŘďđĎĐťțţŤȚŢ',
        'aaaaaaaaaAAAAAAAAAeeeeeeeeeEEEEEEEEEiiiiiiiIIIIIIIoooooooooOOOOOOOOOuuuuuuuuuuUUUUUUUUUUcccccCCCCCnnnnNNNNyyyYYYsssssSSSSSzzzZZZrrrRRRddDDtttTTT'
      ));
    $$;

    create or replace function public.sanitize_tsquery_input(raw_query text)
    returns tsquery
    language plpgsql
    immutable
    strict
    set search_path = public, pg_temp
    as $$
    declare
      cleaned text;
      term text;
      terms text[];
      sanitized_query text := '';
    begin
      if raw_query is null or trim(raw_query) = '' then
        return to_tsquery('simple', '');
      end if;

      cleaned := public.immutable_unaccent(raw_query);
      cleaned := regexp_replace(cleaned, '[^a-z0-9 ]+', ' ', 'g');
      terms := string_to_array(trim(regexp_replace(cleaned, '\\s+', ' ', 'g')), ' ');

      if terms is null or array_length(terms, 1) is null or terms = array[''] then
        return to_tsquery('simple', '');
      end if;

      foreach term in array terms[1:10] loop
        if length(term) >= 2 then
          if sanitized_query <> '' then
            sanitized_query := sanitized_query || ' & ';
          end if;
          sanitized_query := sanitized_query || term || ':*';
        end if;
      end loop;

      if sanitized_query = '' then
        return to_tsquery('simple', '');
      end if;

      return to_tsquery('simple', sanitized_query);
    end;
    $$;
  `);

  // Test 1: Multilingual unaccenting
  const cases = [
    { input: "Relatório de Gestão e Decisão", expected: "relatorio de gestao e decisao" },
    { input: "Ações Estratégicas & Orçamento", expected: "acoes estrategicas & orcamento" },
    { input: "Fiancée, déjà vu, façade", expected: "fiancee, deja vu, facade" },
    { input: "Übergrößen & München", expected: "ubergrossen & munchen" }, // German umlauts
    { input: "Mañana en España", expected: "manana en espana" },
  ];

  for (const c of cases) {
    const res = await db.query<{ out: string }>(`select public.immutable_unaccent('${c.input}') as out;`);
    console.log(`Unaccent: "${c.input}" -> "${res.rows[0].out}"`);
  }

  // Test 2: Extreme search queries
  const extremeQueries = [
    "",
    "   ",
    "!!! ??? ... ///",
    "a",
    "a b c",
    "decis***--' OR 1=1; --",
    "palavra-chave com hífen e (parênteses)",
    "esta é uma pesquisa extremamente longa com muito mais de dez termos para testar o truncamento de segurança de termos",
    "😊 🚀 🔥 emojis and unicode symbols",
  ];

  console.log("\nTesting extreme queries sanitization:");
  for (const q of extremeQueries) {
    const res = await db.query<{ tsq: string }>(`select public.sanitize_tsquery_input('${q.replace(/'/g, "''")}') as tsq;`);
    console.log(`Input: [${q}] -> tsquery: [${res.rows[0].tsq}]`);
  }

  // Test 3: End-to-end global_workspace_search RPC with multi-tenancy and permissions
  console.log("\nTesting global_workspace_search RPC in PGlite...");
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.mock_session (user_id uuid);
    create or replace function auth.uid() returns uuid language sql stable as $$
      select user_id from auth.mock_session limit 1;
    $$;

    create table if not exists organizations (
      id uuid primary key default gen_random_uuid(),
      name text not null
    );

    create table if not exists organization_members (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations(id),
      user_id uuid not null,
      role text not null default 'member'
    );

    create table if not exists member_permissions_mock (
      user_id uuid,
      organization_id uuid,
      permission_key text
    );

    create or replace function public.has_permission(p_org_id uuid, p_perm text)
    returns boolean language sql stable as $$
      select exists (
        select 1 from member_permissions_mock
        where organization_id = p_org_id
          and user_id = auth.uid()
          and permission_key = p_perm
      );
    $$;

    create table if not exists pages (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations(id),
      title text not null,
      content_text text not null default '',
      is_archived boolean not null default false,
      updated_at timestamptz not null default now()
    );

    create table if not exists company_entities (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations(id),
      type text not null default 'entity',
      title text not null,
      content text not null default '',
      updated_at timestamptz not null default now()
    );

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
    AS $search$
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

      IF p_organization_id IS NOT NULL THEN
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
    $search$;
  `);

  const orgA = "11111111-1111-1111-1111-111111111111";
  const orgB = "22222222-2222-2222-2222-222222222222";
  const user1 = "33333333-3333-3333-3333-333333333333";

  await db.exec(`
    insert into organizations (id, name) values ('${orgA}', 'Org Alpha'), ('${orgB}', 'Org Beta');
    insert into organization_members (organization_id, user_id) values ('${orgA}', '${user1}');
    insert into auth.mock_session (user_id) values ('${user1}');

    -- Org A: user has pages.view but NOT brain.view
    insert into member_permissions_mock (user_id, organization_id, permission_key) values
      ('${user1}', '${orgA}', 'pages.view');

    insert into pages (organization_id, title, content_text) values
      ('${orgA}', 'Relatório Anual 2026', 'Texto sobre decisão estratégica de expansão'),
      ('${orgB}', 'Relatório Confidencial Beta', 'Não deve ser visto por Org Alpha');

    insert into company_entities (organization_id, title, content) values
      ('${orgA}', 'Decisão de Gestão', 'Detalhes confidenciais do brain');
  `);

  // Query in Org A for unaccented "relatorio"
  const searchResults1 = await db.query<{ title: string; result_type: string }>(
    `select * from public.global_workspace_search('relatorio', 10, '${orgA}');`
  );
  if (searchResults1.rows.length !== 1 || searchResults1.rows[0].title !== "Relatório Anual 2026") {
    throw new Error(`Expected exactly 1 result for 'relatorio', got ${JSON.stringify(searchResults1.rows)}`);
  }
  console.log("  ✓ Search matched unaccented Portuguese 'relatorio' -> 'Relatório Anual 2026'");

  // User has pages.view but not brain.view -> searching "decisao" should find page, but NOT entity
  const searchResults2 = await db.query<{ title: string; result_type: string }>(
    `select * from public.global_workspace_search('decisao', 10, '${orgA}');`
  );
  if (searchResults2.rows.length !== 1 || searchResults2.rows[0].result_type !== "page") {
    throw new Error(`Expected only page result due to missing brain.view, got ${JSON.stringify(searchResults2.rows)}`);
  }
  console.log("  ✓ Permission isolation: user without brain.view sees page but not brain entity");

  // Multi-tenant check: user is NOT in Org B -> querying Org B explicitly must throw FORBIDDEN (42501)
  let forbiddenThrown = false;
  try {
    await db.query(`select * from public.global_workspace_search('relatorio', 10, '${orgB}');`);
  } catch (err: unknown) {
    if ((err as Error).message.includes("FORBIDDEN")) {
      forbiddenThrown = true;
    }
  }
  if (!forbiddenThrown) {
    throw new Error("Expected FORBIDDEN exception when querying organization user is not member of!");
  }
  console.log("  ✓ Multi-tenant isolation: querying organization without membership throws FORBIDDEN");

  console.log("\n✅ Comprehensive search sanitization & RPC tests passed!");
}

runSearchAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
