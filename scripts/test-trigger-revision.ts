import { PGlite } from "@electric-sql/pglite";

/**
 * Condition 4.2 Verification Test:
 * Proves that trg_pages_increment_revision correctly safeguards revision integrity:
 * 1. Content/title changed without explicit revision update -> automatically increments revision_id.
 * 2. Explicit revision update (e.g. from RPC save_page_content) -> does NOT double-increment.
 * 3. Unrelated metadata update (e.g. position, icon) -> leaves revision_id unchanged.
 */
async function testTriggerRevision() {
  console.log("Starting Condition 4.2 (trg_pages_increment_revision) test in PGlite...");
  const db = new PGlite();

  await db.exec(`
    create table public.pages (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null,
      title text not null default 'Untitled',
      icon text not null default '📄',
      position double precision not null default 0,
      content jsonb not null default '[]'::jsonb,
      content_text text not null default '',
      revision_id bigint not null default 1,
      updated_at timestamptz not null default now()
    );

    CREATE OR REPLACE FUNCTION public.auto_increment_page_revision()
    RETURNS trigger
    LANGUAGE plpgsql
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

    CREATE TRIGGER trg_pages_increment_revision
      BEFORE UPDATE ON public.pages
      FOR EACH ROW
      EXECUTE FUNCTION public.auto_increment_page_revision();
  `);

  const pageId = "33333333-3333-3333-3333-333333333333";
  const orgId = "44444444-4444-4444-4444-444444444444";

  await db.exec(`
    insert into public.pages (id, organization_id, title, content, content_text, revision_id)
    values ('${pageId}', '${orgId}', 'V1 Title', '[{"type":"p","content":"v1"}]'::jsonb, 'v1', 1);
  `);

  console.log("Seeded initial page with revision_id = 1.");

  // Test 1: Implicit update (e.g. legacy script or external write updating content directly)
  await db.exec(`
    update public.pages
    set content = '[{"type":"p","content":"v2 from legacy script"}]'::jsonb,
        content_text = 'v2 from legacy script'
    where id = '${pageId}';
  `);

  const res1 = await db.query<{ revision_id: string }>(`select revision_id from public.pages where id = '${pageId}';`);
  const rev1 = Number(res1.rows[0].revision_id);
  console.log("After implicit content update, revision_id:", rev1);
  if (rev1 !== 2) throw new Error(`Expected revision_id = 2, got ${rev1}`);

  // Test 2: Implicit update of title only
  await db.exec(`
    update public.pages
    set title = 'V2 Updated Title'
    where id = '${pageId}';
  `);

  const res2 = await db.query<{ revision_id: string }>(`select revision_id from public.pages where id = '${pageId}';`);
  const rev2 = Number(res2.rows[0].revision_id);
  console.log("After implicit title update, revision_id:", rev2);
  if (rev2 !== 3) throw new Error(`Expected revision_id = 3, got ${rev2}`);

  // Test 3: Explicit update by RPC (caller specifies revision_id = 4)
  // Trigger should NOT double-increment to 5!
  await db.exec(`
    update public.pages
    set title = 'V3 Title from RPC',
        content = '[{"type":"p","content":"v3 from RPC"}]'::jsonb,
        content_text = 'v3 from RPC',
        revision_id = 4
    where id = '${pageId}';
  `);

  const res3 = await db.query<{ revision_id: string }>(`select revision_id from public.pages where id = '${pageId}';`);
  const rev3 = Number(res3.rows[0].revision_id);
  console.log("After explicit RPC update with revision_id = 4, revision_id:", rev3);
  if (rev3 !== 4) throw new Error(`Expected revision_id = 4 (no double-increment), got ${rev3}`);

  // Test 4: Update unrelated field (icon or position) without touching title or content
  // Trigger should leave revision_id unchanged at 4!
  await db.exec(`
    update public.pages
    set icon = '🚀',
        position = 10.5
    where id = '${pageId}';
  `);

  const res4 = await db.query<{ revision_id: string; icon: string }>(`select revision_id, icon from public.pages where id = '${pageId}';`);
  const rev4 = Number(res4.rows[0].revision_id);
  console.log("After icon & position update, revision_id:", rev4, "icon:", res4.rows[0].icon);
  if (rev4 !== 4) throw new Error(`Expected revision_id to remain 4, got ${rev4}`);

  console.log("✅ Condition 4.2 test PASSED cleanly!\n");
}

testTriggerRevision().catch((e) => {
  console.error("Condition 4.2 test FAILED:", e);
  process.exit(1);
});
