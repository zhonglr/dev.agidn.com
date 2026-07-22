export { InvalidInitialDocumentError, InvalidRevisionStoreStateError } from "./errors.js";
export { InMemoryRevisionStore } from "./in-memory-revision-store.js";
export type { CommitHistoryEntry, HistoryEntry, NavigationHistoryEntry } from "./history.js";
export type { NavigationResult } from "./navigation.js";
export type { ChangeSource, DocumentRevision, RevisionNumber, RevisionStore, RevisionStoreOptions } from "./revision.js";
export {
  checkRevisionStoreState,
  REVISION_STORE_FORMAT_VERSION,
  RevisionStoreStateSchema,
  type RevisionCheckpoint,
  type RevisionStoreState,
  type RevisionStoreStateIssue
} from "./revision-store-state.js";
export type { AppliedTransaction, CommitRequest, CommitResult } from "./transaction.js";
