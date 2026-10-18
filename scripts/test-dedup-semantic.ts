import { PGlite } from "@electric-sql/pglite";

async function testSemanticDeduplication() {
  console.log("Testing full semantic deduplication and pre-flight audit in PGlite...");
  const db = new PGlite();

  await db.exec(`
    create table page_versions (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null default gen_random_uuid(),
      page_id uuid not null default gen_random_uuid(),
      version_number integer not null,
      title text not null default 'Untitled',
      content jsonb not null default '[]'::jsonb,
      content_text text not null default '',
      created_by uuid,
      created_at timestamptz not null default now()
    );

    create table page_activity (
      id uuid primary key default gen_random_uuid(),
      page_id uuid not null,
      actor_id uuid,
      action text not null,
      metadata jsonb not null default '{}'::jsonb
    );
  `);

  const pageClean = "10000000-0000-0000-0000-000000000001";
  const orgClean = "20000000-0000-0000-0000-000000000001";
  const userA = "30000000-0000-0000-0000-000000000001";
  const userB = "30000000-0000-0000-0000-000000000002";

  // Scenario 1: Clean page with legitimate gaps [1, 3, 5]
  await db.exec(`
    insert into page_versions (id, organization_id, page_id, version_number, title, content, content_text, created_by, created_at) values
    ('10000000-0000-0000-0000-000000000011', '${orgClean}', '${pageClean}', 1, 'V1 Title', '[{"t":"p1"}]'::jsonb, 'Text 1', '${userA}', '2026-10-18 10:00:00+00'),
    ('10000000-0000-0000-0000-000000000013', '${orgClean}', '${pageClean}', 3, 'V3 Title', '[{"t":"p3"}]'::jsonb, 'Text 3', '${userA}', '2026-10-18 10:10:00+00'),
    ('10000000-0000-0000-0000-000000000015', '${orgClean}', '${pageClean}', 5, 'V5 Title', '[{"t":"p5"}]'::jsonb, 'Text 5', '${userA}', '2026-10-18 10:20:00+00');
  `);

  // Scenario 2: Identical idempotent duplicate (v2 inserted twice within 50ms with identical title, JSONB, text, author, org)
  const pageDup = "10000000-0000-0000-0000-000000000002";
  await db.exec(`
    insert into page_versions (id, organization_id, page_id, version_number, title, content, content_text, created_by, created_at) values
    ('20000000-0000-0000-0000-000000000021', '${orgClean}', '${pageDup}', 1, 'V1', '[{"block":"1"}]'::jsonb, 'Text 1', '${userA}', '2026-10-18 11:00:00+00'),
    ('20000000-0000-0000-0000-000000000022', '${orgClean}', '${pageDup}', 2, 'V2', '[{"block":"2"}]'::jsonb, 'Text 2', '${userA}', '2026-10-18 11:05:00.100+00'),
    ('20000000-0000-0000-0000-000000000023', '${orgClean}', '${pageDup}', 2, 'V2', '[{"block":"2"}]'::jsonb, 'Text 2', '${userA}', '2026-10-18 11:05:00.150+00'),
    ('20000000-0000-0000-0000-000000000024', '${orgClean}', '${pageDup}', 4, 'V4', '[{"block":"4"}]'::jsonb, 'Text 4', '${userA}', '2026-10-18 11:15:00+00');
  `);

  // Define Pre-flight check & Surgical semantic purge
  const preflightSql = `
    do $$
    declare
      v_ambiguous_count integer;
    begin
      -- Check if any duplicate group has diverging semantic fields (title, content JSONB, text, author, org, or distant timestamp)
      select count(*)
      into v_ambiguous_count
      from (
        select page_id, version_number
        from public.page_versions
        group by page_id, version_number
        having count(*) > 1
           and (
             count(distinct title) > 1
             or count(distinct content::text) > 1
             or count(distinct content_text) > 1
             or count(distinct created_by) > 1
             or count(distinct organization_id) > 1
             or count(distinct date_trunc('second', created_at)) > 1
           )
      ) amb;

      if v_ambiguous_count > 0 then
        raise exception 'MIG-00029 ABORT: Detetadas % colisões ambíguas em page_versions com conteúdos ou metadados divergentes. Abortando para preservar histórico.', v_ambiguous_count;
      end if;
    end $$;
  `;

  // Run preflight on current state (should pass because pageDup v2 is 100% identical)
  await db.exec(preflightSql);
  console.log("Preflight passed on clean + identical duplicates state.");

  // Execute surgical purge of exact redundant copies
  const purgeSql = `
    with semantic_dups as (
      select
        id,
        row_number() over (
          partition by page_id, version_number
          order by created_at asc, id asc
        ) as dup_rank
      from public.page_versions
      where (page_id, version_number) in (
        select page_id, version_number
        from public.page_versions
        group by page_id, version_number
        having count(*) > 1
      )
    )
    delete from public.page_versions
    where id in (
      select id from semantic_dups where dup_rank > 1
    );
  `;
  await db.exec(purgeSql);

  // Check state of clean page [1, 3, 5]
  const p1Res = await db.query<{ version_number: number }>(`select version_number from page_versions where page_id = '${pageClean}' order by version_number;`);
  console.log("PageClean versions (must remain [1, 3, 5]):", p1Res.rows.map(r => r.version_number));
  if (JSON.stringify(p1Res.rows.map(r => r.version_number)) !== JSON.stringify([1, 3, 5])) {
    throw new Error("PageClean gaps were corrupted!");
  }

  // Check state of pageDup [1, 2, 4]
  const p2Res = await db.query<{ version_number: number }>(`select version_number from page_versions where page_id = '${pageDup}' order by version_number;`);
  console.log("PageDup versions (must remain [1, 2, 4]):", p2Res.rows.map(r => r.version_number));
  if (JSON.stringify(p2Res.rows.map(r => r.version_number)) !== JSON.stringify([1, 2, 4])) {
    throw new Error("PageDup was corrupted!");
  }

  // Apply unique index
  await db.exec(`create unique index uq_pv_semantic on page_versions (page_id, version_number);`);
  console.log("Unique constraint created successfully!");

  // Scenario 3: Ambiguous conflict (differing JSONB content under same version number)
  const pageConflict = "10000000-0000-0000-0000-000000000003";
  await db.exec(`
    drop index uq_pv_semantic;
    insert into page_versions (organization_id, page_id, version_number, title, content, content_text, created_by) values
    ('${orgClean}', '${pageConflict}', 1, 'Doc', '[{"a":1}]'::jsonb, 'Same text', '${userA}'),
    ('${orgClean}', '${pageConflict}', 1, 'Doc', '[{"a":2}]'::jsonb, 'Same text', '${userA}');
  `);

  let aborted = false;
  try {
    await db.exec(preflightSql);
  } catch (err: unknown) {
    aborted = true;
    console.log("Correctly aborted on differing JSONB content:", (err as Error).message);
  }

  if (!aborted) {
    throw new Error("Preflight failed to abort on differing JSONB content!");
  }

  console.log("✅ Semantic deduplication and pre-flight abort verified 100%!");
}

testSemanticDeduplication().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
