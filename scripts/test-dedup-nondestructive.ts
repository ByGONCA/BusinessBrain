import { PGlite } from "@electric-sql/pglite";

async function testNonDestructiveMigration() {
  console.log("Testing 100% non-destructive migration pre-check in PGlite...");
  const db = new PGlite();

  await db.exec(`
    create table pages (
      id uuid primary key default gen_random_uuid(),
      title text not null default 'Untitled'
    );

    create table page_versions (
      id uuid primary key default gen_random_uuid(),
      page_id uuid not null references pages(id),
      version_number integer not null,
      title text not null default 'Untitled',
      content jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now()
    );
  `);

  const p1 = "11111111-1111-1111-1111-111111111111";
  await db.exec(`
    insert into pages (id, title) values ('${p1}', 'Clean Page');
    insert into page_versions (page_id, version_number, title) values
    ('${p1}', 1, 'V1'),
    ('${p1}', 3, 'V3'),
    ('${p1}', 5, 'V5');
  `);

  // Migration 00029 pre-check script
  const migrationPrecheck = `
    do $$
    declare
      v_dup_groups integer;
    begin
      select count(*)
      into v_dup_groups
      from (
        select page_id, version_number
        from public.page_versions
        group by page_id, version_number
        having count(*) > 1
      ) dups;

      if v_dup_groups > 0 then
        raise exception 'MIG-00029 PRE-CHECK: Detetados % grupos de versões duplicadas em public.page_versions. A migração 00029 não apaga dados históricos automaticamente.', v_dup_groups;
      end if;
    end $$;

    create unique index if not exists uq_page_versions_page_version
      on public.page_versions (page_id, version_number);
  `;

  // Run on clean state
  await db.exec(migrationPrecheck);
  console.log("Clean state: Unique index created successfully with ZERO rows deleted.");

  // Verify all rows preserved
  const rows = await db.query<{ version_number: number }>(`select version_number from page_versions where page_id = '${p1}' order by version_number;`);
  console.log("Preserved versions (must be [1, 3, 5]):", rows.rows.map(r => r.version_number));
  if (JSON.stringify(rows.rows.map(r => r.version_number)) !== JSON.stringify([1, 3, 5])) {
    throw new Error("Versions corrupted!");
  }

  // Now test state with duplicate:
  const p2 = "22222222-2222-2222-2222-222222222222";
  await db.exec(`
    drop index uq_page_versions_page_version;
    insert into pages (id, title) values ('${p2}', 'Duplicate Page');
    insert into page_versions (page_id, version_number, title) values
    ('${p2}', 1, 'V1'),
    ('${p2}', 2, 'V2 - First Event'),
    ('${p2}', 2, 'V2 - Second Event');
  `);

  let aborted = false;
  try {
    await db.exec(migrationPrecheck);
  } catch (err: unknown) {
    aborted = true;
    console.log("Correctly aborted non-destructively without modifying any rows:", (err as Error).message);
  }

  if (!aborted) {
    throw new Error("Failed to abort on duplicate state!");
  }

  // Confirm NO rows were deleted on p2:
  const p2Rows = await db.query<{ version_number: number }>(`select version_number from page_versions where page_id = '${p2}' order by id;`);
  console.log("P2 rows count after abort (must be 3):", p2Rows.rows.length);
  if (p2Rows.rows.length !== 3) {
    throw new Error("Rows were deleted during aborted migration!");
  }

  console.log("✅ 100% non-destructive migration verified successfully!");
}

testNonDestructiveMigration().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
