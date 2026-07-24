export { InvalidRevisionStoreStateError } from "./errors.js";
export type {
  ChangeSource,
  RevisionNumber,
  RevisionStoreOptions
} from "./revision.js";
export {
  InMemoryProjectRevisionStore,
  InvalidInitialProjectError,
  type ProjectRevisionContext
} from "./in-memory-project-revision-store.js";
export {
  cloneProjectRevision,
  type ProjectNavigationHistoryEntry,
  type ProjectRevision,
  type ProjectRevisionCheckpoint,
  type ProjectSnapshot
} from "./project-revision.js";
export {
  checkProjectRevisionStoreState,
  PROJECT_REVISION_STORE_FORMAT_VERSION,
  ProjectRevisionStoreStateSchema,
  type ProjectRevisionStoreState,
  type ProjectRevisionStoreStateIssue
} from "./project-revision-store-state.js";
export type {
  ProjectCommand,
  ProjectCommandViolation,
  ProjectCommitHistoryEntry,
  ProjectCommitRequest,
  ProjectCommitResult,
  ProjectHistoryEntry,
  ProjectNavigationResult,
  ProjectPatch
} from "./project-transaction.js";
