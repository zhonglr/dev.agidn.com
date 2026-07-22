import { Type } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import type { DocumentPatch } from "./patch.js";

const identifier = Type.String({ minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$" });
const targetFields = {
  nodeId: identifier,
  targetParentId: identifier,
  targetSlot: Type.Optional(Type.String({ minLength: 1 })),
  beforeNodeId: Type.Optional(identifier)
};

export const PatchOperationSchema = Type.Union([
  Type.Object({ op: Type.Literal("node.update"), nodeId: identifier, changes: Type.Record(Type.String(), Type.Unknown()) }, { additionalProperties: false }),
  Type.Object({ op: Type.Literal("node.insert"), ...targetFields }, { additionalProperties: false }),
  Type.Object({ op: Type.Literal("node.move"), ...targetFields }, { additionalProperties: false }),
  Type.Object({ op: Type.Literal("node.remove"), nodeId: identifier }, { additionalProperties: false })
]);

export const DocumentPatchSchema = Type.Object(
  {
    protocolVersion: Type.Literal("1.0.0"),
    commandId: identifier,
    operations: Type.Array(PatchOperationSchema, { minItems: 1 })
  },
  { $id: "DocumentPatch", additionalProperties: false }
);

const compiledDocumentPatch = TypeCompiler.Compile(DocumentPatchSchema);

export function checkDocumentPatch(value: unknown): value is DocumentPatch {
  return compiledDocumentPatch.Check(value);
}
