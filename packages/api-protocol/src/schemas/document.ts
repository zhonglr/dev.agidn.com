import { Type } from "@sinclair/typebox";
import { DocumentPatchSchema, DocumentCommandSchema } from "@agidn/command-engine";
import {
  ApiViolationSchema,
  ChangeSourceSchema,
  DocumentRevisionSchema,
  ProtocolVersionSchema,
  RevisionNumberSchema
} from "./common.js";

export const GetDocumentResponseSchema = Type.Object(
  { protocolVersion: ProtocolVersionSchema, ok: Type.Literal(true), revision: DocumentRevisionSchema },
  { additionalProperties: false }
);

export const CommitCommandsRequestSchema = Type.Object(
  {
    protocolVersion: ProtocolVersionSchema,
    baseRevision: RevisionNumberSchema,
    commands: Type.Array(DocumentCommandSchema, { minItems: 1 }),
    source: Type.Optional(ChangeSourceSchema)
  },
  { additionalProperties: false }
);

export const CommitCommandsResponseSchema = Type.Union([
  Type.Object(
    {
      protocolVersion: ProtocolVersionSchema,
      ok: Type.Literal(true),
      revision: DocumentRevisionSchema,
      patches: Type.Array(DocumentPatchSchema, { minItems: 1 })
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

export const NavigationRequestSchema = Type.Object(
  {
    protocolVersion: ProtocolVersionSchema,
    baseRevision: RevisionNumberSchema,
    source: Type.Optional(ChangeSourceSchema)
  },
  { additionalProperties: false }
);

export const RestoreRevisionRequestSchema = Type.Object(
  {
    protocolVersion: ProtocolVersionSchema,
    baseRevision: RevisionNumberSchema,
    targetRevision: RevisionNumberSchema,
    source: Type.Optional(ChangeSourceSchema)
  },
  { additionalProperties: false }
);

export const NavigationResponseSchema = Type.Union([
  Type.Object(
    { protocolVersion: ProtocolVersionSchema, ok: Type.Literal(true), revision: DocumentRevisionSchema },
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

export const ProtocolErrorResponseSchema = Type.Object(
  {
    protocolVersion: ProtocolVersionSchema,
    ok: Type.Literal(false),
    error: Type.Literal("PROTOCOL_INVALID"),
    issues: Type.Array(Type.Object({ path: Type.String(), message: Type.String() }, { additionalProperties: false }))
  },
  { additionalProperties: false }
);

export const TransportErrorResponseSchema = Type.Object(
  {
    protocolVersion: ProtocolVersionSchema,
    ok: Type.Literal(false),
    error: Type.Union([
      Type.Literal("NOT_FOUND"),
      Type.Literal("METHOD_NOT_ALLOWED"),
      Type.Literal("PAYLOAD_TOO_LARGE"),
      Type.Literal("INVALID_JSON"),
      Type.Literal("INTERNAL_ERROR")
    ]),
    message: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);
