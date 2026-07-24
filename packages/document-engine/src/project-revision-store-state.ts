import {
  DocumentCommandSchema,
  DocumentPatchSchema
} from "@agidn/command-engine";
import { PageDocumentSchema } from "@agidn/document-schema";
import {
  ProjectAssetCommandSchema,
  ProjectAssetPatchSchema,
  ProjectAssetRegistrySchema
} from "@agidn/project-assets";
import { Type } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import type {
  ProjectRevision,
  ProjectRevisionCheckpoint
} from "./project-revision.js";
import type { ProjectHistoryEntry } from "./project-transaction.js";

export const PROJECT_REVISION_STORE_FORMAT_VERSION = "3.0.0" as const;

export interface ProjectRevisionStoreState {
  formatVersion: typeof PROJECT_REVISION_STORE_FORMAT_VERSION;
  revisions: ProjectRevision[];
  history: ProjectHistoryEntry[];
  undoStack: ProjectRevisionCheckpoint[];
  redoStack: ProjectRevisionCheckpoint[];
}

const revisionNumber = Type.Integer({ minimum: 0 });
const source = Type.Union([
  Type.Literal("human"),
  Type.Literal("system"),
  Type.Literal("mcp")
]);
const project = Type.Object(
  {
    document: PageDocumentSchema,
    assets: ProjectAssetRegistrySchema
  },
  { additionalProperties: false }
);
const revision = Type.Object(
  {
    revision: revisionNumber,
    project,
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
const history = Type.Union([
  Type.Object(
    {
      ...historyBase,
      kind: Type.Literal("commit"),
      commands: Type.Array(
        Type.Union([
          DocumentCommandSchema,
          ProjectAssetCommandSchema
        ]),
        { minItems: 1 }
      ),
      patches: Type.Array(
        Type.Union([
          DocumentPatchSchema,
          ProjectAssetPatchSchema
        ]),
        { minItems: 1 }
      )
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      ...historyBase,
      kind: Type.Union([
        Type.Literal("undo"),
        Type.Literal("redo"),
        Type.Literal("restore")
      ]),
      targetRevision: revisionNumber
    },
    { additionalProperties: false }
  )
]);
const checkpoint = Type.Object(
  {
    project,
    originRevision: revisionNumber
  },
  { additionalProperties: false }
);

export const ProjectRevisionStoreStateSchema = Type.Object(
  {
    formatVersion: Type.Literal(
      PROJECT_REVISION_STORE_FORMAT_VERSION
    ),
    revisions: Type.Array(revision, { minItems: 1 }),
    history: Type.Array(history),
    undoStack: Type.Array(checkpoint),
    redoStack: Type.Array(checkpoint)
  },
  {
    $id: "ProjectRevisionStoreState",
    additionalProperties: false
  }
);

export interface ProjectRevisionStoreStateIssue {
  path: string;
  message: string;
}

const compiledState = TypeCompiler.Compile(
  ProjectRevisionStoreStateSchema
);

export function checkProjectRevisionStoreState(
  value: unknown
):
  | { valid: true; state: ProjectRevisionStoreState }
  | { valid: false; issues: ProjectRevisionStoreStateIssue[] } {
  if (!compiledState.Check(value)) {
    return {
      valid: false,
      issues: [...compiledState.Errors(value)].map((error) => ({
        path: error.path || "/",
        message: error.message
      }))
    };
  }
  const state = value as ProjectRevisionStoreState;
  const issues: ProjectRevisionStoreStateIssue[] = [];
  state.revisions.forEach((entry, index) => {
    if (entry.revision !== index) {
      issues.push({
        path: `/revisions/${index}/revision`,
        message: `Expected monotonic revision ${index}.`
      });
    }
    if (Number.isNaN(Date.parse(entry.createdAt))) {
      issues.push({
        path: `/revisions/${index}/createdAt`,
        message: "Expected an ISO-compatible timestamp."
      });
    }
  });
  if (state.history.length !== state.revisions.length - 1) {
    issues.push({
      path: "/history",
      message:
        "History must contain one entry for every revision after revision 0."
    });
  }
  state.history.forEach((entry, index) => {
    if (
      entry.revision !== index + 1 ||
      entry.parentRevision !== index
    ) {
      issues.push({
        path: `/history/${index}`,
        message: "History revision chain is not monotonic."
      });
    }
    if (entry.kind === "commit") {
      if (entry.commands.length !== entry.patches.length) {
        issues.push({
          path: `/history/${index}`,
          message:
            "Commit commands and patches must have equal lengths."
        });
      }
      entry.commands.forEach((command, commandIndex) => {
        if (
          entry.patches[commandIndex]?.commandId !== command.commandId
        ) {
          issues.push({
            path: `/history/${index}/patches/${commandIndex}`,
            message: "Patch commandId must match its command."
          });
        }
      });
    }
  });
  const maximumRevision = state.revisions.length - 1;
  for (const [stackName, checkpoints] of [
    ["undoStack", state.undoStack],
    ["redoStack", state.redoStack]
  ] as const) {
    checkpoints.forEach((entry, index) => {
      if (entry.originRevision > maximumRevision) {
        issues.push({
          path: `/${stackName}/${index}/originRevision`,
          message: "Checkpoint origin exceeds the current revision."
        });
      }
    });
  }
  return issues.length
    ? { valid: false, issues }
    : { valid: true, state };
}
