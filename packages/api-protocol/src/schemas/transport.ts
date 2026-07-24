import { Type } from "@sinclair/typebox";
import {
  ChangeSourceSchema,
  ProtocolVersionSchema,
  RevisionNumberSchema
} from "./common.js";

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

export const ProtocolErrorResponseSchema = Type.Object(
  {
    protocolVersion: ProtocolVersionSchema,
    ok: Type.Literal(false),
    error: Type.Literal("PROTOCOL_INVALID"),
    issues: Type.Array(
      Type.Object(
        { path: Type.String(), message: Type.String() },
        { additionalProperties: false }
      )
    )
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
