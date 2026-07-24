import { DocumentCommandSchema, DocumentPatchSchema } from "@agidn/command-engine";
import { PageDocumentSchema } from "@agidn/document-schema";
import {
  ProjectAssetCommandSchema,
  ProjectAssetPatchSchema,
  ProjectAssetRegistrySchema
} from "@agidn/project-assets";
import { Type } from "@sinclair/typebox";
import {
  ApiViolationSchema,
  ChangeSourceSchema,
  ProtocolVersionSchema,
  RevisionNumberSchema,
  TimestampSchema
} from "./common.js";

export const ProjectSnapshotSchema = Type.Object(
  {
    document: PageDocumentSchema,
    assets: ProjectAssetRegistrySchema
  },
  { additionalProperties: false }
);

export const ProjectRevisionSchema = Type.Object(
  {
    revision: RevisionNumberSchema,
    project: ProjectSnapshotSchema,
    createdAt: TimestampSchema
  },
  { additionalProperties: false }
);

export const GetProjectResponseSchema = Type.Object(
  {
    protocolVersion: ProtocolVersionSchema,
    ok: Type.Literal(true),
    revision: ProjectRevisionSchema
  },
  { additionalProperties: false }
);

export const CommitProjectCommandsRequestSchema = Type.Object(
  {
    protocolVersion: ProtocolVersionSchema,
    baseRevision: RevisionNumberSchema,
    commands: Type.Array(
      Type.Union([
        DocumentCommandSchema,
        ProjectAssetCommandSchema
      ]),
      { minItems: 1 }
    ),
    source: Type.Optional(ChangeSourceSchema)
  },
  { additionalProperties: false }
);

export const CommitProjectCommandsResponseSchema = Type.Union([
  Type.Object(
    {
      protocolVersion: ProtocolVersionSchema,
      ok: Type.Literal(true),
      revision: ProjectRevisionSchema,
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
      protocolVersion: ProtocolVersionSchema,
      ok: Type.Literal(false),
      error: Type.Union([
        Type.Literal("REVISION_CONFLICT"),
        Type.Literal("EMPTY_TRANSACTION"),
        Type.Literal("DUPLICATE_COMMAND"),
        Type.Literal("COMMAND_REJECTED")
      ]),
      currentRevision: RevisionNumberSchema,
      commandId: Type.Optional(Type.String({ minLength: 1 })),
      commandIndex: Type.Optional(Type.Integer({ minimum: 0 })),
      violations: Type.Optional(Type.Array(ApiViolationSchema))
    },
    { additionalProperties: false }
  )
]);

const historyBase = {
  revision: RevisionNumberSchema,
  parentRevision: RevisionNumberSchema,
  createdAt: TimestampSchema,
  source: ChangeSourceSchema
};

export const ProjectHistoryEntrySchema = Type.Union([
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
      targetRevision: RevisionNumberSchema
    },
    { additionalProperties: false }
  )
]);

export const GetProjectHistoryResponseSchema = Type.Object(
  {
    protocolVersion: ProtocolVersionSchema,
    ok: Type.Literal(true),
    currentRevision: RevisionNumberSchema,
    canUndo: Type.Boolean(),
    canRedo: Type.Boolean(),
    entries: Type.Array(ProjectHistoryEntrySchema)
  },
  { additionalProperties: false }
);

export const ProjectNavigationResponseSchema = Type.Union([
  Type.Object(
    {
      protocolVersion: ProtocolVersionSchema,
      ok: Type.Literal(true),
      revision: ProjectRevisionSchema
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      protocolVersion: ProtocolVersionSchema,
      ok: Type.Literal(false),
      error: Type.Union([
        Type.Literal("REVISION_CONFLICT"),
        Type.Literal("NOTHING_TO_UNDO"),
        Type.Literal("NOTHING_TO_REDO"),
        Type.Literal("REVISION_NOT_FOUND"),
        Type.Literal("ALREADY_CURRENT")
      ]),
      currentRevision: RevisionNumberSchema
    },
    { additionalProperties: false }
  )
]);
