import { Type } from "@sinclair/typebox";
import { PageDocumentSchema } from "@agidn/document-schema";

export const ProtocolVersionSchema = Type.Literal("1.0.0");
export const RevisionNumberSchema = Type.Integer({ minimum: 0 });
export const ChangeSourceSchema = Type.Union([Type.Literal("human"), Type.Literal("system"), Type.Literal("mcp")]);
export const TimestampSchema = Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$" });

export const DocumentRevisionSchema = Type.Object(
  {
    revision: RevisionNumberSchema,
    document: PageDocumentSchema,
    createdAt: TimestampSchema
  },
  { additionalProperties: false }
);

export const ApiViolationSchema = Type.Object(
  {
    code: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
    nodeId: Type.Optional(Type.String({ minLength: 1 })),
    path: Type.Optional(Type.String({ minLength: 1 }))
  },
  { additionalProperties: false }
);
