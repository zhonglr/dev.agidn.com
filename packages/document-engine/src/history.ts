import type { DocumentCommand, DocumentPatch } from "@agidn/command-engine";
import type { ChangeSource, RevisionNumber } from "./revision.js";

interface HistoryEntryBase {
  revision: RevisionNumber;
  parentRevision: RevisionNumber;
  createdAt: string;
  source: ChangeSource;
}

export interface CommitHistoryEntry extends HistoryEntryBase {
  kind: "commit";
  commands: DocumentCommand[];
  patches: DocumentPatch[];
}

export interface NavigationHistoryEntry extends HistoryEntryBase {
  kind: "undo" | "redo" | "restore";
  targetRevision: RevisionNumber;
}

export type HistoryEntry = CommitHistoryEntry | NavigationHistoryEntry;
