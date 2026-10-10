/**
 * Legacy Base64 Page Icons Migration Script
 * Migrates inline base64 data URIs stored in pages.icon into:
 * 1. Supabase Storage bucket 'organization_files' under {org_id}/icons/{page_id}.{ext}
 * 2. Organization files table 'public.organization_files'
 * 3. Updates pages.icon_file_id with the new file UUID and clears base64 from pages.icon
 *
 * Fully idempotent: skips pages that already have icon_file_id or non-base64 icons.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env variables
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERROR: Missing Supabase URL or Key configuration.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export async function migrateBase64Icons() {
  console.log("=======================================================");
  console.log("LEGACY BASE64 PAGE ICONS MIGRATION");
  console.log("Target Instance:", supabaseUrl);
  console.log("=======================================================\n");

  // Fetch candidate pages with potential base64 icons and no icon_file_id
  const { data: pages, error } = await supabase
    .from("pages")
    .select("id, organization_id, title, icon, icon_file_id")
    .is("icon_file_id", null)
    .like("icon", "data:image/%");

  if (error) {
    console.error("Failed to query pages for base64 icons:", error.message);
    return { success: false, error: error.message };
  }

  if (!pages || pages.length === 0) {
    console.log("✓ No legacy base64 icons found. All pages are in canonical state.");
    return { success: true, migrated: 0 };
  }

  console.log(`Found ${pages.length} page(s) with legacy base64 icons to migrate.`);

  let migratedCount = 0;
  let failedCount = 0;

  for (const page of pages) {
    try {
      const match = page.icon.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (!match) {
        console.warn(`[SKIP] Page ${page.id} (${page.title}) icon does not match standard base64 format.`);
        continue;
      }

      const mimeSubtype = match[1].toLowerCase();
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, "base64");
      const ext = mimeSubtype === "jpeg" ? "jpg" : mimeSubtype;
      const mimeType = `image/${mimeSubtype}`;
      const storagePath = `${page.organization_id}/icons/${page.id}.${ext}`;
      const fileName = `page-icon-${page.id}.${ext}`;

      // 1. Upload to organization_files storage bucket
      const { error: uploadError } = await supabase.storage
        .from("organization_files")
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        console.error(`[FAIL] Storage upload failed for page ${page.id}:`, uploadError.message);
        failedCount++;
        continue;
      }

      // 2. Insert record in organization_files
      const { data: fileRecord, error: fileError } = await supabase
        .from("organization_files")
        .insert({
          organization_id: page.organization_id,
          name: fileName,
          original_name: `icon.${ext}`,
          mime_type: mimeType,
          size_bytes: buffer.length,
          storage_provider: "company_brain",
          storage_path: storagePath,
          status: "ready",
        })
        .select("id")
        .single();

      if (fileError || !fileRecord) {
        console.error(`[FAIL] File record creation failed for page ${page.id}:`, fileError?.message);
        failedCount++;
        continue;
      }

      // 3. Update page with icon_file_id and remove inline base64
      const { error: pageUpdateError } = await supabase
        .from("pages")
        .update({
          icon_file_id: fileRecord.id,
          icon: "",
        })
        .eq("id", page.id);

      if (pageUpdateError) {
        console.error(`[FAIL] Page update failed for page ${page.id}:`, pageUpdateError.message);
        failedCount++;
        continue;
      }

      console.log(`✓ Migrated page ${page.id} ("${page.title}") -> file ${fileRecord.id}`);
      migratedCount++;
    } catch (err: unknown) {
      console.error(`[FAIL] Exception migrating page ${page.id}:`, err);
      failedCount++;
    }
  }

  console.log(`\nMigration completed: ${migratedCount} migrated, ${failedCount} failed.`);
  return { success: failedCount === 0, migrated: migratedCount, failed: failedCount };
}

// Allow direct CLI execution
if (require.main === module || process.argv[1]?.endsWith("migrate-base64-icons.ts")) {
  migrateBase64Icons().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
