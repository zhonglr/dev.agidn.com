import type {
  DocumentCommand,
  DocumentPatch
} from "@agidn/command-engine";
import type {
  ProjectAssetCommand,
  ProjectAssetCommandViolation,
  ProjectAssetPatch
} from "@agidn/project-assets";
import type { RuleViolation } from "@agidn/rule-engine";
import type { ChangeSource, RevisionNumber } from "./revision.js";
import type {
  ProjectNavigationHistoryEntry,
  ProjectRevision
} from "./project-revision.js";

export type ProjectCommand = DocumentCommand | ProjectAssetCommand;
export type ProjectPatch = DocumentPatch | ProjectAssetPatch;
export type ProjectCommandViolation =
  | RuleViolation
  | ProjectAssetCommandViolation;

export interface ProjectCommitHistoryEntry {
  kind: "commit";
  revision: RevisionNumber;
  parentRevision: RevisionNumber;
  createdAt: string;
  source: ChangeSource;
  commands: ProjectCommand[];
  patches: ProjectPatch[];
}

export type ProjectHistoryEntry =
  | ProjectCommitHistoryEntry
  | ProjectNavigationHistoryEntry;

export interface ProjectCommitRequest {
  baseRevision: RevisionNumber;
  commands: readonly unknown[];
  source?: ChangeSource;
}

export type ProjectCommitResult =
  | {
      accepted: true;
      revision: ProjectRevision;
      patches: ProjectPatch[];
    }
  | {
      accepted: false;
      reason: "REVISION_CONFLICT";
      currentRevision: RevisionNumber;
    }
  | {
      accepted: false;
      reason: "EMPTY_TRANSACTION";
      currentRevision: RevisionNumber;
    }
  | {
      accepted: false;
      reason: "DUPLICATE_COMMAND";
      currentRevision: RevisionNumber;
      commandId: string;
    }
  | {
      accepted: false;
      reason: "COMMAND_REJECTED";
      currentRevision: RevisionNumber;
      commandIndex: number;
      violations: ProjectCommandViolation[];
    };

export type ProjectNavigationResult =
  | { accepted: true; revision: ProjectRevision }
  | {
      accepted: false;
      reason: "REVISION_CONFLICT";
      currentRevision: RevisionNumber;
    }
  | {
      accepted: false;
      reason:
        | "NOTHING_TO_UNDO"
        | "NOTHING_TO_REDO"
        | "REVISION_NOT_FOUND"
        | "ALREADY_CURRENT";
      currentRevision: RevisionNumber;
    };
