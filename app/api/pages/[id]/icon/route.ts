import { NextRequest, NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { isValidUuid } from "@/lib/security/authorization";
import { logger } from "@/lib/security/logger";

const ALLOWED_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

const MAX_ICON_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Private Page Icon Serving Route (GET)
 * Ensures tenant isolation and access control:
 * 1. Requires authenticated user session.
 * 2. Requires active organization membership.
 * 3. Enforces page ownership by the active organization.
 * 4. Resolves icon binary via icon_file_id, storage path, or legacy format.
 * 5. Serves private storage binary with secure caching and content-type headers.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pageId } = await context.params;

    if (!isValidUuid(pageId)) {
      return NextResponse.json({ error: "Invalid page ID." }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return NextResponse.json({ error: "No active organization." }, { status: 403 });
    }

    const supabase = await createClient();

    // Verify page belongs to active organization
    const { data: page, error: pageError } = await supabase
      .from("pages")
      .select("id, organization_id, icon, icon_file_id")
      .eq("id", pageId)
      .eq("organization_id", activeOrg.id)
      .maybeSingle();

    if (pageError || !page) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }

    // 1. Direct Base64 data URI legacy fallback
    if (page.icon?.startsWith("data:image/")) {
      const match = page.icon.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (match) {
        const mime = `image/${match[1].toLowerCase()}`;
        const buffer = Buffer.from(match[2], "base64");
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": mime,
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
    }

    // 2. Direct external URL fallback
    if (page.icon?.startsWith("http://") || page.icon?.startsWith("https://")) {
      return NextResponse.redirect(page.icon, { status: 307 });
    }

    // 3. Resolve target file ID: from icon_file_id, or embedded in custom_id:UUID
    let targetFileId = page.icon_file_id;
    if (!targetFileId && page.icon) {
      const uuidMatch = page.icon.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
      );
      if (uuidMatch && isValidUuid(uuidMatch[0])) {
        targetFileId = uuidMatch[0];
      }
    }

    // 4. If still no file ID, search organization_files for any icon uploaded for this page
    let fileRecord = null;
    if (targetFileId) {
      const { data: file } = await supabase
        .from("organization_files")
        .select("id, organization_id, name, original_name, mime_type, storage_path, storage_provider")
        .eq("id", targetFileId)
        .eq("organization_id", activeOrg.id)
        .maybeSingle();
      fileRecord = file;
    }

    if (!fileRecord) {
      const { data: matchedFile } = await supabase
        .from("organization_files")
        .select("id, organization_id, name, original_name, mime_type, storage_path, storage_provider")
        .eq("organization_id", activeOrg.id)
        .ilike("storage_path", `%${pageId}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (matchedFile) {
        fileRecord = matchedFile;
        // Self-heal: link icon_file_id to page
        await supabase
          .from("pages")
          .update({ icon_file_id: matchedFile.id })
          .eq("id", pageId);
      }
    }

    if (!fileRecord) {
      return NextResponse.json({ error: "Page has no uploaded file icon." }, { status: 404 });
    }

    if (fileRecord.storage_provider === "company_brain" && fileRecord.storage_path) {
      const { data: blob, error: downloadError } = await supabase.storage
        .from("organization_files")
        .download(fileRecord.storage_path);

      if (downloadError || !blob) {
        logger.error("Failed to download page icon from storage", downloadError, {
          pageId,
          iconFileId: fileRecord.id,
        });
        return NextResponse.json({ error: "Failed to retrieve icon asset." }, { status: 500 });
      }

      const buffer = Buffer.from(await blob.arrayBuffer());
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": fileRecord.mime_type || "image/png",
          "Cache-Control": "private, max-age=3600",
          "Content-Disposition": `inline; filename="${encodeURIComponent(fileRecord.original_name)}"`,
        },
      });
    }

    return NextResponse.json({ error: "Unsupported icon storage provider." }, { status: 400 });
  } catch (err: unknown) {
    logger.error("Unexpected error in page icon route", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/**
 * Upload Page Icon (POST)
 * Accepts an image file, saves it to private organization_files bucket and table,
 * links it to pages.icon_file_id, and sets pages.icon = 'custom_id'.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pageId } = await context.params;

    if (!isValidUuid(pageId)) {
      return NextResponse.json({ error: "Invalid page ID." }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return NextResponse.json({ error: "No active organization." }, { status: 403 });
    }

    const supabase = await createClient();

    // Verify page belongs to active organization
    const { data: page, error: pageError } = await supabase
      .from("pages")
      .select("id, organization_id")
      .eq("id", pageId)
      .eq("organization_id", activeOrg.id)
      .maybeSingle();

    if (pageError || !page) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_MIMES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid image format. Supported formats: PNG, JPEG, WebP, GIF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_ICON_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image file exceeds 5MB limit." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split("/")[1] || "png";
    const storagePath = `${activeOrg.id}/icons/${pageId}.${ext}`;
    const fileName = `page-icon-${pageId}.${ext}`;

    // 1. Upload to Supabase Storage bucket
    const { error: uploadError } = await supabase.storage
      .from("organization_files")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      logger.error("Failed to upload page icon to storage bucket", uploadError, {
        pageId,
        orgId: activeOrg.id,
      });
      return NextResponse.json({ error: "Storage upload failed." }, { status: 500 });
    }

    // 2. Insert record in organization_files table
    const { data: fileRecord, error: insertError } = await supabase
      .from("organization_files")
      .insert({
        organization_id: activeOrg.id,
        uploaded_by: user.id,
        name: fileName,
        original_name: file.name || `icon.${ext}`,
        mime_type: file.type,
        size_bytes: file.size,
        storage_provider: "company_brain",
        storage_path: storagePath,
        status: "ready",
      })
      .select("id")
      .single();

    if (insertError || !fileRecord) {
      logger.error("Failed to insert organization_files record for icon", insertError, {
        pageId,
        orgId: activeOrg.id,
      });
      return NextResponse.json({ error: "Could not create icon file record." }, { status: 500 });
    }

    // 3. Link page icon_file_id and set icon identifier
    const iconUrl = `/api/pages/${pageId}/icon`;
    const { error: pageUpdateError } = await supabase
      .from("pages")
      .update({
        icon_file_id: fileRecord.id,
        icon: iconUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pageId)
      .eq("organization_id", activeOrg.id);

    if (pageUpdateError) {
      logger.error("Failed to update page with icon_file_id", pageUpdateError, {
        pageId,
        fileId: fileRecord.id,
      });
      return NextResponse.json({ error: "Could not update page." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      fileId: fileRecord.id,
      iconUrl,
    });
  } catch (err: unknown) {
    logger.error("Unexpected error uploading page icon", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
