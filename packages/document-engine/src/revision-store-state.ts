import { DocumentCommandSchema, DocumentPatchSchema } from "@agidn/command-engine";
import { PageDocumentSchema, type PageDocument } from "@agidn/document-schema";
import { Type } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import type { HistoryEntry } from "./history.js";
import type { DocumentRevision, RevisionNumber } from "./revision.js";

export const REVISION_STORE_FORMAT_VERSION = "1.0.0" as const;

export interface RevisionCheckpoint {
  document: PageDocument;
  originRevision: RevisionNumber;
}

export interface RevisionStoreState {
  formatVersion: typeof REVISION_STORE_FORMAT_VERSION;
  revisions: DocumentRevision[];
  history: HistoryEntry[];
  undoStack: RevisionCheckpoint[];
  redoStack: RevisionCheckpoint[];
}

const revisionNumber = Type.Integer({ minimum: 0 });
const source = Type.Union([Type.Literal("human"), Type.Literal("system"), Type.Literal("mcp")]);
const revision = Type.Object(
  {
    revision: revisionNumber,
    document: PageDocumentSchema,
    createdAt: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);
const historyBase = {
  revision: revisionNumber,
  parentRevision: revisionNumber,
  createdAt: Type.String({ minLength: 1 }),
  source
};
const historyEntry = Type.Union([
  Type.Object(
    {
      ...historyBase,
      kind: Type.Literal("commit"),
      commands: Type.Array(DocumentCommandSchema, { minItems: 1 }),
      patches: Type.Array(DocumentPatchSchema, { minItems: 1 })
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      ...historyBase,
      kind: Type.Union([Type.Literal("undo"), Type.Literal("redo"), Type.Literal("restore")]),
      targetRevision: revisionNumber
    },
    { additionalProperties: false }
  )
]);
const checkpoint = Type.Object(
  { document: PageDocumentSchema, originRevision: revisionNumber },
  { additionalProperties: false }
);

export const RevisionStoreStateSchema = Type.Object(
  {
    formatVersion: Type.Literal(REVISION_STORE_FORMAT_VERSION),
    revisions: Type.Array(revision, { minItems: 1 }),
    history: Type.Array(historyEntry),
    undoStack: Type.Array(checkpoint),
    redoStack: Type.Array(checkpoint)
  },
  { $id: "RevisionStoreState", additionalProperties: false }
);

export interface RevisionStoreStateIssue {
  path: string;
  message: string;
}

const compiledState = TypeCompiler.Compile(RevisionStoreStateSchema);

function invariantIssues(value: RevisionStoreState): RevisionStoreStateIssue[] {
  const issues: RevisionStoreStateIssue[] = [];
  value.revisions.forEach((entry, index) => {
    if (entry.revision !== index) {
      issues.push({ path: `/revisions/${index}/revision`, message: `Expected monotonic revision ${index}.` });
    }
    if (Number.isNaN(Date.parse(entry.createdAt))) {
      issues.push({ path: `/revisions/${index}/createdAt`, message: "Expected an ISO-compatible timestamp." });
    }
  });
  if (value.history.length !== value.revisions.length - 1) {
    issues.push({ path: "/history", message: "History must contain one entry for every revision after revision 0." });
  }
  value.history.forEach((entry, index) => {
    const expectedRevision = index + 1;
    if (entry.revision !== expectedRevision) {
      issues.push({ path: `/history/${index}/revision`, message: `Expected history revision ${expectedRevision}.` });
    }
    if (entry.parentRevision !== index) {
      issues.push({ path: `/history/${index}/parentRevision`, message: `Expected parent revision ${index}.` });
    }
    if (entry.kind === "commit") {
      if (entry.commands.length !== entry.patches.length) {
        issues.push({ path: `/history/${index}`, message: "Commit commands and patches must have equal lengths." });
      }
      entry.commands.forEach((command, commandIndex) => {
        if (entry.patches[commandIndex]?.commandId !== command.commandId) {
          issues.push({ path: `/history/${index}/patches/${commandIndex}`, message: "Patch commandId must match its command." });
        }
      });
    }
  });
  const maximumRevision = value.revisions.length - 1;
  [...value.undoStack, ...value.redoStack].forEach((entry, index) => {
    if (entry.originRevision > maximumRevision) {
      issues.push({ path: `/checkpoints/${index}/originRevision`, message: "Checkpoint origin exceeds the current revision." });
    }
  });
  return issues;
}

export function checkRevisionStoreState(value: unknown):
  | { valid: true; state: RevisionStoreState }
  | { valid: false; issues: RevisionStoreStateIssue[] } {
  if (!compiledState.Check(value)) {
    return {
      valid: false,
      issues: [...compiledState.Errors(value)].map((error) => ({ path: error.path || "/", message: error.message }))
    };
  }
  const state = value as RevisionStoreState;
  const issues = invariantIssues(state);
  return issues.length > 0 ? { valid: false, issues } : { valid: true, state };
}
