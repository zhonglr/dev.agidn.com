import type {
  ChangeSource,
  CommitRequest,
  CommitResult,
  DocumentRevision,
  NavigationResult,
  RevisionNumber
} from "@agidn/document-engine";

export interface WorkspaceRevisionStorePort {
  getCurrent(): DocumentRevision;
  commit(request: CommitRequest): CommitResult | Promise<CommitResult>;
  undo(baseRevision: RevisionNumber, source?: ChangeSource): NavigationResult | Promise<NavigationResult>;
  redo(baseRevision: RevisionNumber, source?: ChangeSource): NavigationResult | Promise<NavigationResult>;
}
