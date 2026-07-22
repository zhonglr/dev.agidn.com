import type { DocumentCommand, DocumentPatch } from "@agidn/command-engine";
import type { RuleViolation } from "@agidn/rule-engine";
import type { ChangeSource, DocumentRevision, RevisionNumber } from "./revision.js";

export interface CommitRequest {
  baseRevision: RevisionNumber;
  commands: readonly unknown[];
  source?: ChangeSource;
}

export type CommitResult =
  | { accepted: true; revision: DocumentRevision; patches: DocumentPatch[] }
  | { accepted: false; reason: "REVISION_CONFLICT"; currentRevision: RevisionNumber }
  | { accepted: false; reason: "EMPTY_TRANSACTION"; currentRevision: RevisionNumber }
  | { accepted: false; reason: "DUPLICATE_COMMAND"; currentRevision: RevisionNumber; commandId: string }
  | { accepted: false; reason: "COMMAND_REJECTED"; currentRevision: RevisionNumber; commandIndex: number; violations: RuleViolation[] };

export interface AppliedTransaction {
  commands: DocumentCommand[];
  patches: DocumentPatch[];
}
