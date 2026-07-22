import type { PageDocument } from "@agidn/document-schema";

export type RevisionNumber = number;
export type ChangeSource = "human" | "system" | "mcp";

export interface DocumentRevision {
  revision: RevisionNumber;
  document: PageDocument;
  createdAt: string;
}

export interface RevisionStoreOptions {
  clock?: () => Date;
}

export function cloneRevision(revision: DocumentRevision): DocumentRevision {
  return structuredClone(revision);
}
