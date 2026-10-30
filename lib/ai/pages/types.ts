import { EditorBlock } from "@/lib/pages/types";

export interface PageDraft {
  id?: string;
  title: string;
  icon?: string;
  summary?: string;
  parentPageId?: string | null;
  blocks: EditorBlock[];
  createdAt?: string;
}

export interface PageDraftGenerationOptions {
  model?: string;
  parentPageId?: string | null;
  contextSources?: string[];
}
