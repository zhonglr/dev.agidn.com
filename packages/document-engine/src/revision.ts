import type { PageDocument } from "@agidn/document-schema";
import type { HistoryEntry } from "./history.js";
import type { NavigationResult } from "./navigation.js";
import type { CommitRequest, CommitResult } from "./transaction.js";

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

export interface RevisionStore {
  readonly currentRevision: RevisionNumber;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  getCurrent(): DocumentRevision;
  getRevision(revision: RevisionNumber): DocumentRevision | undefined;
  getHistory(): HistoryEntry[];
  commit(request: CommitRequest): CommitResult;
  undo(baseRevision: RevisionNumber, source?: ChangeSource): NavigationResult;
  redo(baseRevision: RevisionNumber, source?: ChangeSource): NavigationResult;
}

export function cloneRevision(revision: DocumentRevision): DocumentRevision {
  return structuredClone(revision);
}
