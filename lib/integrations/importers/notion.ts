// ==============================================================================
// Company Brain: Notion Importer & Block-to-Markdown Transpiler
// Transforms Notion Block trees into Markdown, preserving page hierarchy
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
 * Formats Notion Rich Text array into Markdown with annotations (bold, italic, code, link).
 */
export function formatNotionRichText(richTextArray?: any[]): string {
  if (!richTextArray || !Array.isArray(richTextArray)) return "";

  return richTextArray
    .map((item) => {
      let text = item.plain_text || item.text?.content || "";
      const annotations = item.annotations || {};

      if (annotations.code) text = `\`${text}\``;
      if (annotations.bold) text = `**${text}**`;
      if (annotations.italic) text = `*${text}*`;
      if (annotations.strikethrough) text = `~~${text}~~`;
      if (item.href || item.text?.link?.url) {
        text = `[${text}](${item.href || item.text.link.url})`;
      }

      return text;
    })
    .join("");
}

/**
 * Converts a list of Notion block objects into clean Markdown.
 */
export function notionBlocksToMarkdown(blocks: any[]): string {
  if (!blocks || !Array.isArray(blocks)) return "";

  const lines: string[] = [];

  for (const block of blocks) {
    const type = block.type;
    const blockData = block[type];

    switch (type) {
      case "paragraph":
        lines.push(formatNotionRichText(blockData?.rich_text));
        break;

      case "heading_1":
        lines.push(`# ${formatNotionRichText(blockData?.rich_text)}`);
        break;

      case "heading_2":
        lines.push(`## ${formatNotionRichText(blockData?.rich_text)}`);
        break;

      case "heading_3":
        lines.push(`### ${formatNotionRichText(blockData?.rich_text)}`);
        break;

      case "bulleted_list_item":
        lines.push(`- ${formatNotionRichText(blockData?.rich_text)}`);
        break;

      case "numbered_list_item":
        lines.push(`1. ${formatNotionRichText(blockData?.rich_text)}`);
        break;

      case "to_do":
        const checked = blockData?.checked ? "[x]" : "[ ]";
        lines.push(`- ${checked} ${formatNotionRichText(blockData?.rich_text)}`);
        break;

      case "quote":
        lines.push(`> ${formatNotionRichText(blockData?.rich_text)}`);
        break;

      case "callout":
        const icon = blockData?.icon?.emoji || "💡";
        lines.push(`> [!NOTE] ${icon}\n> ${formatNotionRichText(blockData?.rich_text)}`);
        break;

      case "code":
        const lang = blockData?.language || "";
        lines.push(`\`\`\`${lang}\n${formatNotionRichText(blockData?.rich_text)}\n\`\`\``);
        break;

      case "divider":
        lines.push("---");
        break;

      case "bookmark":
        const url = blockData?.url || "";
        lines.push(`[${url}](${url})`);
        break;

      default:
        if (blockData?.rich_text) {
          lines.push(formatNotionRichText(blockData.rich_text));
        }
        break;
    }
  }

  return lines.join("\n\n").trim();
}

/**
 * Imports a batch of parsed Notion page nodes into imported_documents,
 * preserving parent-child relationships and skipping duplicate unmodified pages.
 */
export async function importNotionNodes(
  organizationId: string,
  nodes: ImportedDocumentNode[],
  databaseOrWorkspaceId: string
): Promise<ImportBatchResult> {
  const supabase = createServiceClient();
  const startTime = Date.now();

  const { data: syncLog } = await supabase
    .from("integration_sync_logs")
    .insert({
      organization_id: organizationId,
      provider: "notion",
      sync_type: "database_import",
      status: "in_progress",
      details: { databaseOrWorkspaceId, totalNodes: nodes.length },
    })
    .select("id")
    .single();

  const logId = syncLog?.id;
  let importedCount = 0;
  let skippedDuplicates = 0;
  let failedCount = 0;
  const errors: string[] = [];

  // Query existing imported documents for hash comparison
  const { data: existingDocs } = await supabase
    .from("imported_documents")
    .select("source_id, content_hash")
    .eq("organization_id", organizationId)
    .eq("source_platform", "notion");

  const existingMap = new Map<string, string>();
  for (const doc of existingDocs || []) {
    existingMap.set(doc.source_id, doc.content_hash);
  }

  for (const node of nodes) {
    try {
      const existingHash = existingMap.get(node.sourceId);

      // Deduplication: skip if content hash matches
      if (existingHash && existingHash === node.contentHash) {
        skippedDuplicates++;
        continue;
      }

      const { error: upsertErr } = await supabase.from("imported_documents").upsert(
        {
          organization_id: organizationId,
          source_platform: "notion",
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
            databaseOrWorkspaceId,
            importedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id, source_platform, source_id" }
      );

      if (upsertErr) {
        failedCount++;
        errors.push(`Failed Notion page ${node.sourceId}: ${upsertErr.message}`);
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
          databaseOrWorkspaceId,
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
    platform: "notion",
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
 * Connects to Notion REST API to query database pages and child blocks, importing into BusinessBrain.
 */
export async function importNotionDatabase(
  organizationId: string,
  params: {
    integrationToken: string;
    databaseId: string;
  }
): Promise<ImportBatchResult> {
  const rawId = params.databaseId.split("?")[0].split("/").pop() || params.databaseId;
  const cleanDbId = rawId.replace(/-/g, "");
  logger.info("Starting Notion database import", { databaseId: cleanDbId });

  const headers = {
    Authorization: `Bearer ${params.integrationToken}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };

  // 1. Query database items
  const queryRes = await fetch(`https://api.notion.com/v1/databases/${cleanDbId}/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ page_size: 50 }),
  });

  if (!queryRes.ok) {
    throw new Error(`Notion API returned HTTP ${queryRes.status}: ${queryRes.statusText}`);
  }

  const queryData = await queryRes.json();
  const pages = queryData.results || [];
  const nodes: ImportedDocumentNode[] = [];

  for (const page of pages) {
    const pageId = page.id;
    // Extract title from title property
    let title = "Untitled Notion Page";
    for (const propKey of Object.keys(page.properties || {})) {
      const prop = page.properties[propKey];
      if (prop.type === "title" && prop.title) {
        title = formatNotionRichText(prop.title) || title;
        break;
      }
    }

    // Determine parent id
    const parentSourceId =
      page.parent?.page_id || page.parent?.database_id || cleanDbId;

    // Fetch page blocks (first page)
    let markdown = "";
    try {
      const blocksRes = await fetch(
        `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`,
        { headers }
      );
      if (blocksRes.ok) {
        const blocksData = await blocksRes.json();
        markdown = notionBlocksToMarkdown(blocksData.results || []);
      }
    } catch (blockErr) {
      logger.warn("Failed to fetch child blocks for Notion page", { pageId });
    }

    if (!markdown) {
      markdown = `# ${title}\n\n*Imported from Notion database.*`;
    }

    const contentHash = computeContentHash(markdown);

    nodes.push({
      sourceId: pageId,
      sourcePlatform: "notion",
      parentSourceId: parentSourceId ? String(parentSourceId) : undefined,
      title,
      contentMarkdown: markdown,
      sourceUrl: page.url,
      metadata: {
        createdTime: page.created_time,
        lastEditedTime: page.last_edited_time,
        databaseId: cleanDbId,
      },
      contentHash,
    });
  }

  return importNotionNodes(organizationId, nodes, cleanDbId);
}
