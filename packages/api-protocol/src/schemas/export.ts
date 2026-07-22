import { Type } from "@sinclair/typebox";
import { ProtocolVersionSchema, RevisionNumberSchema } from "./common.js";

export const ContextManifestSchema = Type.Object(
  {
    protocolVersion: ProtocolVersionSchema,
    documentId: Type.String({ minLength: 1 }),
    schemaVersion: Type.String({ minLength: 1 }),
    hashAlgorithm: Type.Literal("sha256"),
    files: Type.Record(Type.String({ minLength: 1 }), Type.String({ pattern: "^[a-f0-9]{64}$" })),
    contentHash: Type.String({ pattern: "^[a-f0-9]{64}$" })
  },
  { additionalProperties: false }
);

export const ExportContextRequestSchema = Type.Object(
  {
    protocolVersion: ProtocolVersionSchema,
    revision: Type.Optional(RevisionNumberSchema)
  },
  { additionalProperties: false }
);

export const ExportContextResponseSchema = Type.Union([
  Type.Object(
    {
      protocolVersion: ProtocolVersionSchema,
      ok: Type.Literal(true),
      revision: RevisionNumberSchema,
      outputDirectory: Type.String({ minLength: 1 }),
      manifest: ContextManifestSchema
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      protocolVersion: ProtocolVersionSchema,
      ok: Type.Literal(false),
      error: Type.Literal("REVISION_NOT_FOUND"),
      requestedRevision: RevisionNumberSchema,
      currentRevision: RevisionNumberSchema
    },
    { additionalProperties: false }
  )
]);
