import assert from "node:assert";
import { PGlite } from "@electric-sql/pglite";
import {
  validateFileMetadata,
  sanitizeFilename,
  ALLOWED_MIME_TYPES,
  DEFAULT_MAX_FILE_SIZE_BYTES,
} from "../lib/storage/validation";

let passed = 0;
let failed = 0;

function testAssert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function runStorageSecurityTests() {
  console.log("\n=======================================================");
  console.log("COMPANY BRAIN: SUPABASE STORAGE SECURITY VERIFICATION");
  console.log("=======================================================\n");

  // ---------------------------------------------------------------------------
  // PART 1: APPLICATION LAYER (VALIDATION, MIME, TRAVERSAL, EXTENSIONS)
  // ---------------------------------------------------------------------------
  console.log("[1] Testing Storage Validation & Filename Sanitization:");

  // Path traversal
  assert.strictEqual(sanitizeFilename("../../etc/passwd"), "passwd");
  assert.strictEqual(sanitizeFilename("..\\..\\windows\\system32\\cmd.exe"), "cmd.exe");
  assert.strictEqual(sanitizeFilename("..//..//folder//secret.pdf"), "secret.pdf");
  assert.strictEqual(sanitizeFilename(".hidden_file"), "_.hidden_file");
  testAssert(true, "Directory traversal sequences and leading dots properly sanitized");

  // Allowed vs Forbidden MIME types
  testAssert(ALLOWED_MIME_TYPES.includes("application/pdf"), "PDF is permitted");
  testAssert(ALLOWED_MIME_TYPES.includes("image/png"), "PNG is permitted");
  testAssert(!ALLOWED_MIME_TYPES.includes("image/svg+xml" as any), "SVG is strictly excluded from allowed MIME types");
  testAssert(!ALLOWED_MIME_TYPES.includes("application/x-msdownload" as any), "EXE is strictly excluded");

  // Validate File Metadata
  const validPdf = validateFileMetadata("annual_report.pdf", "application/pdf", 1024 * 1024);
  testAssert(validPdf.isValid && validPdf.sanitizedFilename === "annual_report.pdf", "Valid PDF passes validation");

  const svgAttempt = validateFileMetadata("vector_icon.svg", "image/svg+xml", 1024);
  testAssert(!svgAttempt.isValid && Boolean(svgAttempt.error?.includes("File format")), "SVG upload is rejected by validation");

  const oversizedAttempt = validateFileMetadata("large_archive.zip", "application/pdf", 30 * 1024 * 1024); // 30MB
  testAssert(!oversizedAttempt.isValid && Boolean(oversizedAttempt.error?.includes("exceeds")), "Oversized file (>25MB) is rejected");

  const dangerousExeAttempt = validateFileMetadata("installer.exe", "text/plain", 1024); // Fake MIME
  testAssert(!dangerousExeAttempt.isValid && Boolean(dangerousExeAttempt.error?.includes("File type")), "Dangerous extension (.exe) rejected even with benign MIME");

  // ---------------------------------------------------------------------------
  // PART 2: DATABASE ENGINE STORAGE RLS POLICIES (MIGRATION 00030)
  // ---------------------------------------------------------------------------
  console.log("\n[2] Testing Storage Objects RLS Policies in PGlite (PostgreSQL 16):");
  const pg = new PGlite();

  // Create mock schema and storage functions
  await pg.exec(`
    create schema if not exists storage;
    create schema if not exists auth;

    create table auth.users (
      id uuid primary key default gen_random_uuid()
    );

    create table auth.current_session (
      user_id uuid
    );

    create or replace function auth.uid() returns uuid language sql stable as $$
      select user_id from auth.current_session limit 1;
    $$;

    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );

    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets(id),
      name text not null,
      owner uuid,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    -- Mock storage.foldername function
    create or replace function storage.foldername(name text)
    returns text[] language plpgsql immutable as $$
    declare
      parts text[];
    begin
      parts := string_to_array(name, '/');
      if array_length(parts, 1) <= 1 then
        return array[]::text[];
      end if;
      return parts[1:array_length(parts, 1) - 1];
    end;
    $$;

    -- Setup BusinessBrain permissions schema
    create table public.organizations (
      id uuid primary key default gen_random_uuid(),
      name text not null
    );

    create table public.organization_members (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id),
      user_id uuid not null,
      role text not null default 'member'
    );

    create table public.member_permission_overrides (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id),
      user_id uuid not null,
      permission_key text not null,
      effect text not null check (effect in ('allow', 'deny'))
    );

    create or replace function public.has_org_role(target_org_id uuid, allowed_roles text[])
    returns boolean language sql stable as $$
      select exists (
        select 1 from public.organization_members
        where organization_id = target_org_id
          and user_id = auth.uid()
          and role = any(allowed_roles)
      );
    $$;

    create or replace function public.has_permission(target_org_id uuid, required_key text)
    returns boolean language plpgsql stable as $$
    declare
      v_uid uuid := auth.uid();
      v_role text;
      v_override text;
    begin
      if v_uid is null or target_org_id is null then return false; end if;

      select role into v_role from public.organization_members
      where organization_id = target_org_id and user_id = v_uid;
      if v_role is null then return false; end if;
      if v_role = 'owner' then return true; end if;

      select effect into v_override from public.member_permission_overrides
      where organization_id = target_org_id and user_id = v_uid and permission_key = required_key;

      if v_override = 'deny' then return false; end if;
      if v_override = 'allow' then return true; end if;

      -- Default member permissions: members hold files.view and files.upload unless denied
      if required_key in ('files.view', 'files.upload') then return true; end if;
      return false;
    end;
    $$;
  `);

  // Insert bucket
  await pg.exec(`
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('organization_files', 'organization_files', false, 52428800);
  `);

  // Apply Migration 00030 RLS policies to storage.objects
  await pg.exec(`
    alter table storage.objects enable row level security;
    alter table storage.objects force row level security;

    create policy "Authorized members can read organization files"
      on storage.objects for select
      using (
        bucket_id = 'organization_files'
        and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (
          public.has_org_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
          or public.has_permission((storage.foldername(name))[1]::uuid, 'files.view')
        )
      );

    create policy "Authorized members can upload organization files"
      on storage.objects for insert
      with check (
        bucket_id = 'organization_files'
        and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (
          public.has_org_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
          or public.has_permission((storage.foldername(name))[1]::uuid, 'files.upload')
        )
      );

    create policy "Authorized members can delete organization files"
      on storage.objects for delete
      using (
        bucket_id = 'organization_files'
        and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (
          public.has_org_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
          or public.has_permission((storage.foldername(name))[1]::uuid, 'files.delete')
        )
      );
    -- Role and permission grants for RLS enforcement
    drop role if exists authenticated;
    create role authenticated nologin;
    grant usage on schema storage, public, auth to authenticated;
    grant all on all tables in schema storage, public, auth to authenticated;
    grant execute on all functions in schema storage, public, auth to authenticated;
  `);

  // Seed test organizations & users
  const org1 = "11111111-1111-1111-1111-111111111111";
  const org2 = "22222222-2222-2222-2222-222222222222";
  const userMember = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const userRestricted = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const userAdmin = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  await pg.exec(`
    insert into public.organizations (id, name) values ('${org1}', 'Alpha'), ('${org2}', 'Beta');
    insert into public.organization_members (organization_id, user_id, role) values
      ('${org1}', '${userMember}', 'member'),
      ('${org1}', '${userRestricted}', 'member'),
      ('${org1}', '${userAdmin}', 'admin');

    -- userRestricted has explicit DENY on files.upload
    insert into public.member_permission_overrides (organization_id, user_id, permission_key, effect) values
      ('${org1}', '${userRestricted}', 'files.upload', 'deny');
  `);

  async function setSession(userId: string | null) {
    await pg.exec(`reset role;`);
    await pg.exec(`delete from auth.current_session;`);
    if (userId) {
      await pg.exec(`insert into auth.current_session (user_id) values ('${userId}');`);
    }
    await pg.exec(`set role authenticated;`);
  }

  // Scenario 1: Authorized member uploads to their org folder
  await setSession(userMember);
  await pg.exec(`
    insert into storage.objects (bucket_id, name, owner)
    values ('organization_files', '${org1}/file-1/report.pdf', '${userMember}');
  `);
  testAssert(true, "Scenario 1: Authorized member can upload to their org folder in storage.objects");

  // Scenario 2: Non-member attempts upload to Org 2
  let s2Threw = false;
  try {
    await pg.exec(`
      insert into storage.objects (bucket_id, name, owner)
      values ('organization_files', '${org2}/file-x/hacked.pdf', '${userMember}');
    `);
  } catch {
    s2Threw = true;
  }
  testAssert(s2Threw, "Scenario 2: Non-member upload to different org is blocked by RLS");

  // Scenario 3: Non-member attempts to read Org 1 file
  await setSession("99999999-9999-9999-9999-999999999999"); // outsider
  const outsiderRead = await pg.query(`select * from storage.objects where name like '${org1}/%';`);
  testAssert(outsiderRead.rows.length === 0, "Scenario 3: Non-member cannot select/read files from Org 1 (0 rows)");

  // Scenario 4: Authenticated member with explicit DENY on files.upload attempts direct upload
  await setSession(userRestricted);
  let s4Threw = false;
  try {
    await pg.exec(`
      insert into storage.objects (bucket_id, name, owner)
      values ('organization_files', '${org1}/file-2/restricted.pdf', '${userRestricted}');
    `);
  } catch {
    s4Threw = true;
  }
  testAssert(s4Threw, "Scenario 4: Direct SDK upload by member with DENY on files.upload is blocked by RLS");

  // Scenario 5: Malicious/malformed folder path (e.g. root upload or non-uuid)
  await setSession(userMember);
  let s5Threw = false;
  try {
    await pg.exec(`
      insert into storage.objects (bucket_id, name, owner)
      values ('organization_files', 'root-file.pdf', '${userMember}');
    `);
  } catch {
    s5Threw = true;
  }
  testAssert(s5Threw, "Scenario 5: Upload outside organization folder prefix is rejected safely by regex");

  let s5NonUuidThrew = false;
  try {
    await pg.exec(`
      insert into storage.objects (bucket_id, name, owner)
      values ('organization_files', 'not-a-uuid/file.pdf', '${userMember}');
    `);
  } catch {
    s5NonUuidThrew = true;
  }
  testAssert(s5NonUuidThrew, "Scenario 5b: Non-UUID folder prefix is rejected safely without database error");

  // Scenario 6: Read-only member attempts delete
  let s6Threw = false;
  try {
    await pg.exec(`
      delete from storage.objects where name = '${org1}/file-1/report.pdf';
    `);
  } catch {
    s6Threw = true;
  }
  const fileStillExists = await pg.query<{ cnt: string | number }>(`select count(*) as cnt from storage.objects where name = '${org1}/file-1/report.pdf';`);
  testAssert(Number(fileStillExists.rows[0]?.cnt) === 1, "Scenario 6: Member without files.delete cannot delete file (file preserved)");

  // Scenario 7: Admin can delete file
  await setSession(userAdmin);
  const adminSelect = await pg.query(`
    select * from storage.objects where name = '${org1}/file-1/report.pdf';
  `);
  console.log("  userAdmin select rows:", adminSelect.rows.length);
  const delRes = await pg.query(`
    delete from storage.objects where name = '${org1}/file-1/report.pdf' returning *;
  `);
  console.log("  Scenario 7 deleted rows:", delRes.rows.length);
  await pg.exec(`reset role;`);
  const fileDeleted = await pg.query<{ cnt: string | number }>(`select count(*) as cnt from storage.objects where name = '${org1}/file-1/report.pdf';`);
  testAssert(Number(fileDeleted.rows[0]?.cnt) === 0, "Scenario 7: Admin can delete file in their organization");

  console.log(`\nStorage Security Verification Complete: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runStorageSecurityTests().catch((err) => {
  console.error("Storage test error:", err);
  process.exit(1);
});
