import type { PageDocument } from "@agidn/document-schema";
import type { ProjectAssetRegistry } from "@agidn/project-assets";
import type { ChangeSource, RevisionNumber } from "./revision.js";

export interface ProjectSnapshot {
  document: PageDocument;
  assets: ProjectAssetRegistry;
}

export interface ProjectRevision {
  revision: RevisionNumber;
  project: ProjectSnapshot;
  createdAt: string;
}

export interface ProjectRevisionCheckpoint {
  project: ProjectSnapshot;
  originRevision: RevisionNumber;
}

export interface ProjectNavigationHistoryEntry {
  kind: "undo" | "redo" | "restore";
  revision: RevisionNumber;
  parentRevision: RevisionNumber;
  createdAt: string;
  source: ChangeSource;
  targetRevision: RevisionNumber;
}

export function cloneProjectRevision(
  revision: ProjectRevision
): ProjectRevision {
  return structuredClone(revision);
}
