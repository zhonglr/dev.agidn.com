import { Type } from "@sinclair/typebox";
import { DocumentCommandSchema, DocumentPatchSchema } from "@agidn/command-engine";
import { ChangeSourceSchema, ProtocolVersionSchema, RevisionNumberSchema, TimestampSchema } from "./common.js";

const historyBase = {
  revision: RevisionNumberSchema,
  parentRevision: RevisionNumberSchema,
  createdAt: TimestampSchema,
  source: ChangeSourceSchema
};

export const HistoryEntrySchema = Type.Union([
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
      kind: Type.Union([Type.Literal("undo"), Type.Literal("redo")]),
      targetRevision: RevisionNumberSchema
    },
    { additionalProperties: false }
  )
]);

export const GetHistoryResponseSchema = Type.Object(
  {
    protocolVersion: ProtocolVersionSchema,
    ok: Type.Literal(true),
    currentRevision: RevisionNumberSchema,
    canUndo: Type.Boolean(),
    canRedo: Type.Boolean(),
    entries: Type.Array(HistoryEntrySchema)
  },
  { additionalProperties: false }
);
