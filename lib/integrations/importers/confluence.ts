// ==============================================================================
// Company Brain: Confluence Importer & Markdown Transpiler
// Transforms Confluence Storage XHTML format into Markdown, preserving page hierarchy
// SHA-256 content deduplication prevents redundant page duplication.
// ==============================================================================

import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { ImportedDocumentNode, ImportBatchResult } from "./types";
import { logger } from "@/lib/security/logger";

/**
 * Computes deterministic SHA-256 content hash for deduplication.
 */
export function computeContentHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Converts Confluence Storage Format XHTML into clean Markdown.
 */
export function confluenceStorageToMarkdown(xhtml: string): string {
  if (!xhtml) return "";

  let md = xhtml;

  // Replace Confluence code macros: <ac:structured-macro ac:name="code">...<ac:plain-text-body><![CDATA[...]]></ac:plain-text-body></ac:structured-macro>
  md = md.replace(
    /<ac:structured-macro[^>]*ac:name="code"[^>]*>[\s\S]*?<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>[\s\S]*?<\/ac:structured-macro>/gi,
    (_match, code) => `\n\`\`\`\n${code.trim()}\n\`\`\`\n`
  );

  // Replace Confluence info / tip / warning / note macros
  md = md.replace(
    /<ac:structured-macro[^>]*ac:name="(info|tip|note|warning)"[^>]*>[\s\S]*?<ac:rich-text-body>([\s\S]*?)<\/ac:rich-text-body>[\s\S]*?<\/ac:structured-macro>/gi,
    (_match, type, text) => `\n> [!${type.toUpperCase()}]\n> ${text.replace(/<[^>]+>/g, "").trim()}\n`
  );

  // Strip remaining Atlassian XML macro wrappers
  md = md.replace(/<ac:[^>]+>|<\/ac:[^>]+>/gi, "");
  md = md.replace(/<ri:[^>]+>|<\/ri:[^>]+>/gi, "");

  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n");
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n");

  // Bold & Italic
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");

  // Inline code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // Lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<ul[^>]*>|<\/ul>/gi, "\n");
  md = md.replace(/<ol[^>]*>|<\/ol>/gi, "\n");

  // Paragraphs & Line Breaks
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n");
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Remove any remaining HTML tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  md = md
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Normalize excessive blank lines
  return md.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Imports a batch of parsed Confluence page nodes into imported_documents,
 * preserving parent-child relationships and skipping duplicate unmodified pages.
 */
export async function importConfluenceNodes(
  organizationId: string,
  nodes: ImportedDocumentNode[],
  spaceKey: string
): Promise<ImportBatchResult> {
  const supabase = createServiceClient();
  const startTime = Date.now();

  const { data: syncLog } = await supabase
    .from("integration_sync_logs")
    .insert({
      organization_id: organizationId,
      provider: "confluence",
      sync_type: "space_import",
      status: "in_progress",
      details: { spaceKey, totalNodes: nodes.length },
    })
    .select("id")
    .single();

  const logId = syncLog?.id;
  let importedCount = 0;
  let skippedDuplicates = 0;
  let failedCount = 0;
  const errors: string[] = [];

  // Query existing imported documents for this organization & platform to check hashes
  const { data: existingDocs } = await supabase
    .from("imported_documents")
    .select("source_id, content_hash")
    .eq("organization_id", organizationId)
    .eq("source_platform", "confluence");

  const existingMap = new Map<string, string>();
  for (const doc of existingDocs || []) {
    existingMap.set(doc.source_id, doc.content_hash);
  }

  for (const node of nodes) {
    try {
      const existingHash = existingMap.get(node.sourceId);

      // Deduplication check: if hash matches, skip re-importing identical document
      if (existingHash && existingHash === node.contentHash) {
        skippedDuplicates++;
        continue;
      }

      const { error: upsertErr } = await supabase.from("imported_documents").upsert(
        {
          organization_id: organizationId,
          source_platform: "confluence",
          source_id: node.sourceId,
          source_url: node.sourceUrl || null,
          parent_source_id: node.parentSourceId || null,
          title: node.title,
          content_format: "markdown",
          content_payload: node.contentMarkdown,
          content_hash: node.contentHash,
          sync_status: existingHash ? "updated" : "imported",
          metadata: {
            ...node.metadata,
            spaceKey,
            importedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id, source_platform, source_id" }
      );

      if (upsertErr) {
        failedCount++;
        errors.push(`Failed page ${node.sourceId}: ${upsertErr.message}`);
      } else {
        importedCount++;
      }
    } catch (err: any) {
      failedCount++;
      errors.push(`Error on node ${node.sourceId}: ${err.message}`);
    }
  }

  const durationMs = Date.now() - startTime;

  if (logId) {
    await supabase
      .from("integration_sync_logs")
      .update({
        status: failedCount > 0 ? "partial" : "completed",
        items_synced: importedCount,
        items_failed: failedCount,
        completed_at: new Date().toISOString(),
        details: {
          spaceKey,
          importedCount,
          skippedDuplicates,
          failedCount,
          durationMs,
        },
        error_message: errors.length > 0 ? errors.join("; ") : null,
      })
      .eq("id", logId);
  }

  return {
    success: failedCount === 0 || importedCount > 0,
    platform: "confluence",
    totalFound: nodes.length,
    importedCount,
    skippedDuplicates,
    failedCount,
    durationMs,
    syncLogId: logId,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Connects to Confluence Cloud REST API and imports all pages in a given space.
 */
export async function importConfluenceSpace(
  organizationId: string,
  params: {
    domain: string;
    email: string;
    apiToken: string;
    spaceKey: string;
  }
): Promise<ImportBatchResult> {
  const cleanDomain = params.domain
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\/wiki\/?$/i, "");
  const baseUrl = `https://${cleanDomain}/wiki/rest/api`;
  const authHeader = `Basic ${Buffer.from(`${params.email}:${params.apiToken}`).toString("base64")}`;

  logger.info("Starting Confluence space import", { domain: cleanDomain, spaceKey: params.spaceKey });

  let start = 0;
  const limit = 50;
  let hasMore = true;
  const nodes: ImportedDocumentNode[] = [];

  while (hasMore && start < 500) {
    const url = `${baseUrl}/content?spaceKey=${encodeURIComponent(
      params.spaceKey
    )}&expand=body.storage,ancestors,version&limit=${limit}&start=${start}`;

    const res = await fetch(url, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Confluence API returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const results = data.results || [];

    for (const item of results) {
      if (item.type !== "page") continue;

      const xhtmlBody = item.body?.storage?.value || "";
      const markdown = confluenceStorageToMarkdown(xhtmlBody);
      const contentHash = computeContentHash(markdown);

      // Determine parent source id from ancestors array
      const ancestors = item.ancestors || [];
      const parentSourceId = ancestors.length > 0 ? ancestors[ancestors.length - 1]?.id : undefined;

      nodes.push({
        sourceId: String(item.id),
        sourcePlatform: "confluence",
        parentSourceId: parentSourceId ? String(parentSourceId) : undefined,
        title: item.title || "Untitled Confluence Page",
        contentMarkdown: markdown,
        sourceUrl: `https://${cleanDomain}/wiki${item._links?.webui || ""}`,
        metadata: {
          version: item.version?.number,
          spaceKey: params.spaceKey,
        },
        contentHash,
      });
    }

    if (results.length < limit) {
      hasMore = false;
    } else {
      start += limit;
    }
  }

  return importConfluenceNodes(organizationId, nodes, params.spaceKey);
}
