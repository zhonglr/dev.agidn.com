import type {
  ChangeSource,
  CommitRequest,
  CommitResult,
  DocumentRevision,
  HistoryEntry,
  NavigationResult,
  RevisionNumber
} from "@agidn/document-engine";

export interface WorkspaceRevisionStorePort {
  readonly currentRevision: RevisionNumber;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  getCurrent(): DocumentRevision;
  getRevision(revision: RevisionNumber): DocumentRevision | undefined;
  getHistory(): HistoryEntry[];
  commit(request: CommitRequest): CommitResult | Promise<CommitResult>;
  undo(baseRevision: RevisionNumber, source?: ChangeSource): NavigationResult | Promise<NavigationResult>;
  redo(baseRevision: RevisionNumber, source?: ChangeSource): NavigationResult | Promise<NavigationResult>;
}
