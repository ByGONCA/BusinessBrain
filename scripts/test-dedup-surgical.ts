import { PGlite } from "@electric-sql/pglite";

async function run() {
  console.log("Starting surgical deduplication test in PGlite...");
  const db = new PGlite();
  await db.exec(`
    create table page_versions (
      id uuid primary key default gen_random_uuid(),
      page_id uuid not null,
      version_number integer not null,
      title text not null,
      content text not null,
      content_text text not null,
      created_at timestamptz not null default now()
    );
  `);

  const page1 = "11111111-1111-1111-1111-111111111111";
  // Page 1: Gaps, no duplicates (v1, v3, v5)
  await db.exec(`
    insert into page_versions (page_id, version_number, title, content, content_text) values
    ('${page1}', 1, 'T1', 'C1', 'C1'),
    ('${page1}', 3, 'T3', 'C3', 'C3'),
    ('${page1}', 5, 'T5', 'C5', 'C5');
  `);

  const page2 = "22222222-2222-2222-2222-222222222222";
  // Page 2: Duplicate v2 with identical content, plus non-conflicting v4
  await db.exec(`
    insert into page_versions (page_id, version_number, title, content, content_text) values
    ('${page2}', 1, 'T1', 'C1', 'C1'),
    ('${page2}', 2, 'T2', 'C2', 'C2'),
    ('${page2}', 2, 'T2', 'C2', 'C2'),
    ('${page2}', 4, 'T4', 'C4', 'C4');
  `);

  // 1. Pre-flight check: Ambiguity check
  const amb = await db.query<{ page_id: string; version_number: number }>(`
    select page_id, version_number
    from page_versions
    group by page_id, version_number
    having count(*) > 1 and count(distinct content_text) > 1;
  `);
  console.log("Pre-flight check: Ambiguities found before collision:", amb.rows.length);
  if (amb.rows.length > 0) {
    throw new Error("Pre-flight check failed unexpectedly!");
  }

  // 2. Exact duplicate removal using partition by (page_id, version_number)
  const del = await db.query<{ id: string }>(`
    with ranked_dups as (
      select
        id,
        row_number() over (
          partition by page_id, version_number
          order by created_at asc, id asc
        ) as dup_rank
      from page_versions
      where (page_id, version_number) in (
        select page_id, version_number
        from page_versions
        group by page_id, version_number
        having count(*) > 1 and count(distinct content_text) = 1
      )
    )
    delete from page_versions
    where id in (
      select id from ranked_dups where dup_rank > 1
    ) returning id;
  `);
  console.log("Superfluous identical duplicates safely purged:", del.rows.length);

  // Check state of page 1:
  const p1_res = await db.query<{ version_number: number }>(`select version_number from page_versions where page_id = '${page1}' order by version_number`);
  const p1_versions = p1_res.rows.map(r => r.version_number);
  console.log("Page 1 versions (must be [1, 3, 5]):", p1_versions);
  if (JSON.stringify(p1_versions) !== JSON.stringify([1, 3, 5])) {
    throw new Error(`Page 1 was corrupted! Got ${JSON.stringify(p1_versions)}`);
  }

  // Check state of page 2:
  const p2_res = await db.query<{ version_number: number }>(`select version_number from page_versions where page_id = '${page2}' order by version_number`);
  const p2_versions = p2_res.rows.map(r => r.version_number);
  console.log("Page 2 versions (must be [1, 2, 4]):", p2_versions);
  if (JSON.stringify(p2_versions) !== JSON.stringify([1, 2, 4])) {
    throw new Error(`Page 2 was corrupted! Got ${JSON.stringify(p2_versions)}`);
  }

  // 3. Create unique index
  await db.exec(`create unique index uq_page_versions_page_version on page_versions (page_id, version_number);`);
  console.log("Unique constraint created successfully without renumbering non-conflicting versions!");

  // 4. Test ambiguous case triggering abort:
  const page3 = "33333333-3333-3333-3333-333333333333";
  await db.exec(`
    drop index uq_page_versions_page_version;
    insert into page_versions (page_id, version_number, title, content, content_text) values
    ('${page3}', 1, 'T1', 'C1', 'C1'),
    ('${page3}', 2, 'T2-A', 'C2-A', 'Conflicting Content A'),
    ('${page3}', 2, 'T2-B', 'C2-B', 'Conflicting Content B');
  `);

  const ambTest = await db.query<{ page_id: string; version_number: number }>(`
    select page_id, version_number
    from page_versions
    group by page_id, version_number
    having count(*) > 1 and count(distinct content_text) > 1;
  `);
  console.log("Ambiguous cases detected on Page 3:", ambTest.rows.length);
  if (ambTest.rows.length !== 1) {
    throw new Error("Failed to detect ambiguous conflicting version!");
  }
  console.log("✅ Surgical deduplication and ambiguity abort verified successfully!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
