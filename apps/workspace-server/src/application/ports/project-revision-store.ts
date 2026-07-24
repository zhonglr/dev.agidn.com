import type {
  ChangeSource,
  ProjectCommitRequest,
  ProjectCommitResult,
  ProjectHistoryEntry,
  ProjectNavigationResult,
  ProjectRevision,
  RevisionNumber
} from "@agidn/document-engine";

export interface WorkspaceProjectRevisionStorePort {
  readonly currentRevision: RevisionNumber;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  getCurrent(): ProjectRevision;
  getRevision(revision: RevisionNumber): ProjectRevision | undefined;
  getHistory(): ProjectHistoryEntry[];
  commit(
    request: ProjectCommitRequest
  ): ProjectCommitResult | Promise<ProjectCommitResult>;
  undo(
    baseRevision: RevisionNumber,
    source?: ChangeSource
  ): ProjectNavigationResult | Promise<ProjectNavigationResult>;
  redo(
    baseRevision: RevisionNumber,
    source?: ChangeSource
  ): ProjectNavigationResult | Promise<ProjectNavigationResult>;
  restore(
    baseRevision: RevisionNumber,
    targetRevision: RevisionNumber,
    source?: ChangeSource
  ): ProjectNavigationResult | Promise<ProjectNavigationResult>;
}
