import { PGlite } from "@electric-sql/pglite";

/**
 * Condition 4.1 Verification Test:
 * Proves that snippet insertion respects OCC:
 * 1. Matches expected revision -> succeeds and advances revision_id.
 * 2. Stale revision (concurrent editor write) -> rejects with STALE_WRITE and preserves page.
 */
async function testSnippetOCC() {
  console.log("Starting Condition 4.1 (addCodeSnippetToPageAction OCC) test in PGlite...");
  const db = new PGlite();

  await db.exec(`
    create table public.pages (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null,
      title text not null default 'Untitled',
      content jsonb not null default '[]'::jsonb,
      content_text text not null default '',
      revision_id bigint not null default 1,
      updated_at timestamptz not null default now()
    );

    create or replace function public.save_page_content(
      p_page_id uuid,
      p_expected_revision bigint,
      p_title text default null,
      p_content jsonb default '[]'::jsonb,
      p_content_text text default ''
    )
    returns jsonb
    language plpgsql
    as $$
    declare
      v_current_rev bigint;
      v_next_rev bigint;
    begin
      select revision_id into v_current_rev
      from public.pages
      where id = p_page_id
      for update;

      if v_current_rev <> p_expected_revision then
        raise exception 'STALE_WRITE: Page revision mismatch. Expected %, got %', p_expected_revision, v_current_rev;
      end if;

      v_next_rev := v_current_rev + 1;

      update public.pages
      set title = coalesce(p_title, title),
          content = p_content,
          content_text = p_content_text,
          revision_id = v_next_rev,
          updated_at = now()
      where id = p_page_id;

      return jsonb_build_object('success', true, 'revision_id', v_next_rev);
    end;
    $$;
  `);

  const pageId = "11111111-1111-1111-1111-111111111111";
  const orgId = "22222222-2222-2222-2222-222222222222";

  await db.exec(`
    insert into public.pages (id, organization_id, title, content, content_text, revision_id)
    values ('${pageId}', '${orgId}', 'Architecture Doc', '[{"type":"p","content":"Intro"}]'::jsonb, 'Intro', 1);
  `);

  console.log("Seeded initial page with revision_id = 1.");

  // Test 1: Snippet inserted when expectedRevision = 1 (matching current revision)
  const res1 = await db.query<{ save_page_content: { success: boolean; revision_id: number } }>(`
    select public.save_page_content(
      '${pageId}'::uuid,
      1::bigint,
      'Architecture Doc',
      '[{"type":"p","content":"Intro"},{"type":"code","content":"const x = 1;"}]'::jsonb,
      'Intro const x = 1;'
    );
  `);

  const nextRev = res1.rows[0].save_page_content.revision_id;
  console.log("Snippet inserted successfully with revision_id:", nextRev);
  if (nextRev !== 2) throw new Error(`Expected revision_id = 2, got ${nextRev}`);

  // Test 2: Concurrent editor edit occurs in background (revision becomes 3)
  await db.exec(`
    update public.pages
    set content = '[{"type":"p","content":"Intro updated by editor"}]'::jsonb,
        content_text = 'Intro updated by editor',
        revision_id = 3
    where id = '${pageId}';
  `);
  console.log("Simulated concurrent editor save: page revision advanced to 3.");

  // Test 3: Another snippet insertion attempts to write with stale expected revision (expected = 2)
  let caughtConflict = false;
  try {
    await db.query(`
      select public.save_page_content(
        '${pageId}'::uuid,
        2::bigint,
        'Architecture Doc',
        '[{"type":"code","content":"stale snippet"}]'::jsonb,
        'stale snippet'
      );
    `);
  } catch (err: unknown) {
    if ((err as Error).message.includes("STALE_WRITE")) {
      caughtConflict = true;
      console.log("✅ Successfully caught STALE_WRITE on snippet insertion with stale token!");
    } else {
      throw err;
    }
  }

  if (!caughtConflict) {
    throw new Error("Failed: Snippet insertion should have thrown STALE_WRITE but succeeded!");
  }

  // Verify page content was NOT clobbered
  const pageCheck = await db.query<{ content_text: string; revision_id: string }>(`
    select content_text, revision_id from public.pages where id = '${pageId}';
  `);
  if (!pageCheck.rows[0].content_text.includes("updated by editor")) {
    throw new Error("Page content was improperly overwritten!");
  }
  console.log("✅ Page content was preserved intact. Current revision:", pageCheck.rows[0].revision_id);
  console.log("Condition 4.1 test PASSED cleanly!\n");
}

testSnippetOCC().catch((e) => {
  console.error("Condition 4.1 test FAILED:", e);
  process.exit(1);
});
