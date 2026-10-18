import { PGlite } from "@electric-sql/pglite";

async function testMonotonicRevisionOCC() {
  console.log("Testing monotonic revision_id OCC and transactional restore in PGlite...");
  const db = new PGlite();

  await db.exec(`
    create table organizations (
      id uuid primary key default gen_random_uuid(),
      name text not null
    );

    create table users (
      id uuid primary key default gen_random_uuid(),
      email text not null
    );

    create table organization_members (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations(id),
      user_id uuid not null references users(id),
      role text not null default 'member'
    );

    create table pages (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations(id),
      title text not null,
      icon text not null default '📄',
      content jsonb not null default '[]'::jsonb,
      content_text text not null default '',
      revision_id bigint not null default 1,
      last_edited_by uuid references users(id),
      is_archived boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table page_versions (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations(id),
      page_id uuid not null references pages(id) on delete cascade,
      version_number integer not null,
      title text not null,
      content jsonb not null default '[]'::jsonb,
      content_text text not null default '',
      created_by uuid references users(id),
      created_at timestamptz not null default now()
    );

    create unique index uq_page_versions_page_version on page_versions (page_id, version_number);

    create table page_activity (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations(id),
      page_id uuid not null references pages(id) on delete cascade,
      actor_id uuid not null references users(id),
      action text not null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  `);

  // Auth mock functions
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.mock_session (
      user_id uuid
    );

    create or replace function auth.uid() returns uuid language sql stable as $$
      select user_id from auth.mock_session limit 1;
    $$;

    create or replace function public.is_org_member(p_org_id uuid) returns boolean language plpgsql stable as $$
    declare
      v_user_id uuid := auth.uid();
    begin
      if v_user_id is null then return false; end if;
      return exists (select 1 from organization_members where organization_id = p_org_id and user_id = v_user_id);
    end;
    $$;

    create or replace function public.has_permission(p_org_id uuid, p_permission text) returns boolean language plpgsql stable as $$
    begin
      return public.is_org_member(p_org_id);
    end;
    $$;
  `);

  // Create save_page_content with monotonic revision_id
  await db.exec(`
    create or replace function public.save_page_content(
      p_page_id uuid,
      p_title text,
      p_icon text,
      p_content jsonb,
      p_content_text text,
      p_expected_revision bigint,
      p_create_snapshot boolean default false
    )
    returns jsonb
    language plpgsql
    security definer
    set search_path = public, pg_temp
    as $$
    declare
      v_user_id uuid;
      v_org_id uuid;
      v_current_revision bigint;
      v_next_version integer;
      v_next_revision bigint;
      v_now timestamptz := clock_timestamp();
    begin
      v_user_id := auth.uid();
      if v_user_id is null then
        return jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'error', 'Authentication required');
      end if;

      -- Acquire pessimistic row lock
      select organization_id, revision_id
      into v_org_id, v_current_revision
      from public.pages
      where id = p_page_id and is_archived = false
      for update;

      if not found then
        return jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'error', 'Page not found or unavailable');
      end if;

      if not public.is_org_member(v_org_id) then
        return jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'error', 'Access denied to organization');
      end if;

      if not public.has_permission(v_org_id, 'pages.edit') then
        return jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'error', 'Insufficient permissions to edit page');
      end if;

      -- Monotonic revision OCC check
      if p_expected_revision is null then
        return jsonb_build_object(
          'success', false,
          'code', 'MISSING_OCC_TOKEN',
          'error', 'expected_revision is strictly required for concurrency control'
        );
      end if;

      if v_current_revision <> p_expected_revision then
        return jsonb_build_object(
          'success', false,
          'code', 'STALE_WRITE',
          'error', 'Page was modified concurrently by another session or restore',
          'current_revision', v_current_revision
        );
      end if;

      v_next_revision := v_current_revision + 1;

      update public.pages
      set title = p_title,
          icon = coalesce(p_icon, icon),
          content = p_content,
          content_text = p_content_text,
          revision_id = v_next_revision,
          last_edited_by = v_user_id,
          updated_at = v_now
      where id = p_page_id;

      if p_create_snapshot then
        select coalesce(max(version_number), 0) + 1
        into v_next_version
        from public.page_versions
        where page_id = p_page_id;

        insert into public.page_versions (
          organization_id, page_id, version_number,
          title, content, content_text, created_by, created_at
        ) values (
          v_org_id, p_page_id, v_next_version,
          p_title, p_content, p_content_text, v_user_id, v_now
        );

        insert into public.page_activity (
          organization_id, page_id, actor_id, action, metadata, created_at
        ) values (
          v_org_id, p_page_id, v_user_id, 'content_edited',
          jsonb_build_object('version_number', v_next_version, 'revision_id', v_next_revision),
          v_now
        );
      end if;

      return jsonb_build_object(
        'success', true,
        'revision_id', v_next_revision,
        'version_number', v_next_version
      );
    end;
    $$;
  `);

  // Create restore_page_version incrementing revision_id
  await db.exec(`
    create or replace function public.restore_page_version(
      p_page_id uuid,
      p_target_version integer
    )
    returns jsonb
    language plpgsql
    security definer
    set search_path = public, pg_temp
    as $$
    declare
      v_user_id uuid;
      v_page record;
      v_target_version record;
      v_safety_version integer;
      v_next_revision bigint;
      v_org_id uuid;
      v_now timestamptz := clock_timestamp();
    begin
      v_user_id := auth.uid();
      if v_user_id is null then
        return jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'error', 'Authentication required');
      end if;

      select id, organization_id, title, content, content_text, revision_id
      into v_page
      from public.pages
      where id = p_page_id and is_archived = false
      for update;

      if not found then
        return jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'error', 'Page not found or unavailable');
      end if;

      v_org_id := v_page.organization_id;

      if not public.is_org_member(v_org_id) then
        return jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'error', 'Access denied to organization');
      end if;

      if not public.has_permission(v_org_id, 'pages.edit') then
        return jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'error', 'Insufficient permissions to edit page');
      end if;

      select title, content, content_text
      into v_target_version
      from public.page_versions
      where page_id = p_page_id
        and organization_id = v_org_id
        and version_number = p_target_version;

      if not found then
        return jsonb_build_object('success', false, 'code', 'VERSION_NOT_FOUND', 'error', 'Target version does not exist');
      end if;

      select coalesce(max(version_number), 0) + 1
      into v_safety_version
      from public.page_versions
      where page_id = p_page_id;

      v_next_revision := v_page.revision_id + 1;

      -- Safety snapshot of current page
      insert into public.page_versions (
        organization_id, page_id, version_number,
        title, content, content_text, created_by, created_at
      ) values (
        v_org_id, p_page_id, v_safety_version,
        v_page.title, v_page.content, v_page.content_text, v_user_id, v_now
      );

      -- Restore target version to page
      update public.pages
      set title = v_target_version.title,
          content = v_target_version.content,
          content_text = v_target_version.content_text,
          revision_id = v_next_revision,
          last_edited_by = v_user_id,
          updated_at = v_now
      where id = p_page_id;

      -- Audit entry
      insert into public.page_activity (
        organization_id, page_id, actor_id, action, metadata, created_at
      ) values (
        v_org_id, p_page_id, v_user_id, 'version_restored',
        jsonb_build_object(
          'restored_from_version', p_target_version,
          'safety_snapshot_version', v_safety_version,
          'revision_id', v_next_revision
        ),
        v_now
      );

      return jsonb_build_object(
        'success', true,
        'restored_version', p_target_version,
        'safety_snapshot_version', v_safety_version,
        'revision_id', v_next_revision
      );
    end;
    $$;
  `);

  // Seed data
  const orgRes = await db.query<{ id: string }>(`insert into organizations (name) values ('Acme Corp') returning id;`);
  const orgId = orgRes.rows[0].id;
  const userRes = await db.query<{ id: string }>(`insert into users (email) values ('alice@acme.com') returning id;`);
  const userId = userRes.rows[0].id;
  await db.exec(`insert into organization_members (organization_id, user_id, role) values ('${orgId}', '${userId}', 'admin');`);
  await db.exec(`insert into auth.mock_session (user_id) values ('${userId}');`);

  // Insert initial page (initial revision_id = 1)
  const pageRes = await db.query<{ id: string; revision_id: string }>(`
    insert into pages (organization_id, title, content, content_text)
    values ('${orgId}', 'Original V1 Title', '[{"type":"p","text":"V1"}]'::jsonb, 'V1 text')
    returning id, revision_id;
  `);
  const pageId = pageRes.rows[0].id;
  const initialRevision = Number(pageRes.rows[0].revision_id);
  console.log("Seed complete. Page created with revision_id:", initialRevision);
  if (initialRevision !== 1) {
    throw new Error(`Expected initial revision 1, got ${initialRevision}`);
  }

  // Insert Version 1 in page_versions
  await db.exec(`
    insert into page_versions (organization_id, page_id, version_number, title, content, content_text, created_by)
    values ('${orgId}', '${pageId}', 1, 'Original V1 Title', '[{"type":"p","text":"V1"}]'::jsonb, 'V1 text', '${userId}');
  `);

  // 1. Normal save with expected_revision = 1
  const save1 = await db.query<{ save_page_content: { success: boolean; revision_id: number; version_number: number } }>(`
    select public.save_page_content(
      '${pageId}'::uuid,
      'Modified Title V2',
      '📄',
      '[{"type":"p","text":"V2 content"}]'::jsonb,
      'V2 content text',
      1::bigint,
      true
    ) as save_page_content;
  `);
  console.log("Save 1 result:", save1.rows[0].save_page_content);
  if (!save1.rows[0].save_page_content.success || save1.rows[0].save_page_content.revision_id !== 2) {
    throw new Error("Save 1 failed or revision was not 2!");
  }

  // 2. Test missing expected_revision token rejection
  const nullTokenSave = await db.query<{ save_page_content: { success: boolean; code: string } }>(`
    select public.save_page_content(
      '${pageId}'::uuid,
      'Bypass Attempt',
      '📄',
      '[]'::jsonb,
      '',
      null::bigint,
      false
    ) as save_page_content;
  `);
  console.log("Null token test (must be MISSING_OCC_TOKEN):", nullTokenSave.rows[0].save_page_content);
  if (nullTokenSave.rows[0].save_page_content.code !== "MISSING_OCC_TOKEN") {
    throw new Error("Missing token was not rejected!");
  }

  // 3. Tab B triggers restore of Version 1 (page revision becomes 2 + 1 = 3)
  const restoreRes = await db.query<{ restore_page_version: { success: boolean; revision_id: number; safety_snapshot_version: number } }>(`
    select public.restore_page_version(
      '${pageId}'::uuid,
      1
    ) as restore_page_version;
  `);
  console.log("Restore result:", restoreRes.rows[0].restore_page_version);
  if (!restoreRes.rows[0].restore_page_version.success || restoreRes.rows[0].restore_page_version.revision_id !== 3) {
    throw new Error("Restore failed or revision was not 3!");
  }

  // 4. In-flight autosave from Tab A arrives now, sending expected_revision = 2 (from before restore)!
  const staleSave = await db.query<{ save_page_content: { success: boolean; code: string; current_revision: number } }>(`
    select public.save_page_content(
      '${pageId}'::uuid,
      'Stale V2 Overwrite Attempt',
      '📄',
      '[{"type":"p","text":"Stale"}]'::jsonb,
      'Stale text',
      2::bigint,
      false
    ) as save_page_content;
  `);
  console.log("Stale save result (must be STALE_WRITE with current_revision 3):", staleSave.rows[0].save_page_content);
  if (staleSave.rows[0].save_page_content.code !== "STALE_WRITE" || staleSave.rows[0].save_page_content.current_revision !== 3) {
    throw new Error(`Expected STALE_WRITE with revision 3, got: ${JSON.stringify(staleSave.rows[0].save_page_content)}`);
  }

  // 5. Verify page title is still Original V1 Title
  const pageFinal = await db.query<{ title: string; revision_id: string }>(`select title, revision_id from pages where id = '${pageId}';`);
  console.log("Final page state:", pageFinal.rows[0]);
  if (pageFinal.rows[0].title !== "Original V1 Title" || Number(pageFinal.rows[0].revision_id) !== 3) {
    throw new Error("Page was corrupted by stale save!");
  }

  console.log("✅ Monotonic revision_id OCC and transactional restore verified 100%!");
}

testMonotonicRevisionOCC().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
