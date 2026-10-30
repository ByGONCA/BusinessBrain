import crypto from "crypto";
import { z } from "zod";
import { EditorBlock, BlockType } from "@/lib/pages/types";
import { PageDraft } from "./types";
import { AIError } from "../types";

const ALLOWED_BLOCK_TYPES: BlockType[] = [
  "paragraph",
  "heading_1",
  "heading_2",
  "heading_3",
  "bullet_list",
  "numbered_list",
  "checklist",
  "toggle",
  "quote",
  "divider",
  "code",
  "callout",
  "table",
];

const BlockSchema = z.object({
  id: z.string().optional(),
  type: z.enum(ALLOWED_BLOCK_TYPES as [string, ...string[]]),
  content: z.string().max(20000),
  properties: z.record(z.unknown()).optional(),
});

const PageDraftSchema = z.object({
  title: z.string().min(1).max(200),
  icon: z.string().max(10).optional(),
  summary: z.string().max(1000).optional(),
  parentPageId: z.string().uuid().nullable().optional(),
  blocks: z.array(BlockSchema).min(1).max(200),
});

export class AIPageGenerator {
  /**
   * Validates that an array of blocks adheres strictly to BusinessBrain's native EditorBlock schema.
   * Strips any unsafe HTML tags (<script>, <iframe>, onclick).
   */
  static validateBlocks(rawBlocks: unknown[]): EditorBlock[] {
    if (!Array.isArray(rawBlocks)) {
      throw new AIError("Estrutura de blocos inválida: esperado array.", "INVALID_REQUEST", 400);
    }

    const sanitizedBlocks: EditorBlock[] = [];

    for (const item of rawBlocks) {
      const parsed = BlockSchema.safeParse(item);
      if (!parsed.success) {
        throw new AIError(
          `Bloco inválido rejeitado: ${parsed.error.message}`,
          "INVALID_REQUEST",
          400
        );
      }

      const block = parsed.data;
      // Sanitize content against script injection, event handlers, and pseudo-protocols
      const cleanContent = block.content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
        .replace(/javascript:[^"'\s]*/gi, "")
        .replace(/data:text\/html[^"'\s]*/gi, "");

      // Sanitize properties if present
      let cleanProperties = block.properties;
      if (cleanProperties && typeof cleanProperties === "object") {
        const propsCopy: Record<string, unknown> = { ...cleanProperties };
        for (const [key, val] of Object.entries(propsCopy)) {
          if (typeof val === "string" && (val.toLowerCase().startsWith("javascript:") || val.toLowerCase().startsWith("data:text/html"))) {
            propsCopy[key] = "";
          }
        }
        cleanProperties = propsCopy;
      }

      sanitizedBlocks.push({
        id: block.id || crypto.randomUUID(),
        type: block.type as BlockType,
        content: cleanContent,
        properties: cleanProperties,
      });
    }

    return sanitizedBlocks;
  }

  /**
   * Validates a complete PageDraft before interactive preview or persistence.
   */
  static validateDraft(rawDraft: unknown): PageDraft {
    const parsed = PageDraftSchema.safeParse(rawDraft);
    if (!parsed.success) {
      throw new AIError(
        `Rascunho de página inválido: ${parsed.error.message}`,
        "INVALID_REQUEST",
        400
      );
    }

    return {
      title: parsed.data.title,
      icon: parsed.data.icon || "📄",
      summary: parsed.data.summary,
      parentPageId: parsed.data.parentPageId || null,
      blocks: this.validateBlocks(parsed.data.blocks),
    };
  }

  /**
   * Generates a template draft from structured outline or prompts.
   */
  static createDefaultDraft(title: string, summary: string, rawContent: string): PageDraft {
    const paragraphs = rawContent
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    const blocks: EditorBlock[] = [
      {
        id: crypto.randomUUID(),
        type: "heading_1",
        content: title,
      },
    ];

    if (summary) {
      blocks.push({
        id: crypto.randomUUID(),
        type: "callout",
        content: summary,
        properties: { calloutIcon: "💡" },
      });
    }

    for (const para of paragraphs) {
      if (para.startsWith("# ")) {
        blocks.push({ id: crypto.randomUUID(), type: "heading_1", content: para.slice(2).trim() });
      } else if (para.startsWith("## ")) {
        blocks.push({ id: crypto.randomUUID(), type: "heading_2", content: para.slice(3).trim() });
      } else if (para.startsWith("### ")) {
        blocks.push({ id: crypto.randomUUID(), type: "heading_3", content: para.slice(4).trim() });
      } else if (para.startsWith("- ") || para.startsWith("* ")) {
        blocks.push({ id: crypto.randomUUID(), type: "bullet_list", content: para.slice(2).trim() });
      } else {
        blocks.push({ id: crypto.randomUUID(), type: "paragraph", content: para });
      }
    }

    return {
      title,
      icon: "📄",
      summary,
      blocks,
    };
  }
}
