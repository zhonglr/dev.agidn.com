import type { DocumentRevision, RevisionNumber } from "./revision.js";

export type NavigationResult =
  | { accepted: true; revision: DocumentRevision }
  | { accepted: false; reason: "REVISION_CONFLICT"; currentRevision: RevisionNumber }
  | { accepted: false; reason: "NOTHING_TO_UNDO" | "NOTHING_TO_REDO" | "REVISION_NOT_FOUND" | "ALREADY_CURRENT"; currentRevision: RevisionNumber };
