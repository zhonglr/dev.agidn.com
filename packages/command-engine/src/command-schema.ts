import { Type } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { PageNodeSchema, ResponsiveColumnsSchema } from "@agidn/document-schema";
import type { DocumentCommand } from "./command.js";

const identifier = Type.String({ minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$" });
const propertyName = Type.String({ minLength: 1, pattern: "^[A-Za-z][A-Za-z0-9]*$" });
const tokenReference = Type.String({ minLength: 3, pattern: "^[a-z][a-z0-9-]*(?:\\.[a-z][a-z0-9-]*)+$" });
const base = Type.Object({ commandId: identifier, protocolVersion: Type.Literal("1.0.0") });

function command<T extends ReturnType<typeof Type.Object>>(payload: T) {
  return Type.Composite([base, payload], { additionalProperties: false });
}

export const DocumentCommandSchema = Type.Union(
  [
    command(Type.Object({ type: Type.Literal("node.setLayoutProperty"), nodeId: identifier, property: propertyName, value: Type.Unknown() })),
    command(Type.Object({ type: Type.Literal("node.setProp"), nodeId: identifier, property: propertyName, value: Type.Unknown() })),
    command(Type.Object({ type: Type.Literal("node.setVariant"), nodeId: identifier, variant: identifier })),
    command(Type.Object({ type: Type.Literal("node.setToken"), nodeId: identifier, property: propertyName, tokenRef: tokenReference })),
    command(Type.Object({ type: Type.Literal("node.setResponsivePolicy"), nodeId: identifier, columns: ResponsiveColumnsSchema })),
    command(Type.Object({ type: Type.Literal("node.setRole"), nodeId: identifier, role: identifier })),
    command(Type.Object({ type: Type.Literal("node.remove"), nodeId: identifier })),
    command(Type.Object({
      type: Type.Literal("node.move"),
      nodeId: identifier,
      targetParentId: identifier,
      targetSlot: Type.Optional(propertyName),
      beforeNodeId: Type.Optional(identifier)
    })),
    command(Type.Object({
      type: Type.Literal("node.insert"),
      targetParentId: identifier,
      targetSlot: Type.Optional(propertyName),
      beforeNodeId: Type.Optional(identifier),
      node: PageNodeSchema
    }))
  ],
  { $id: "DocumentCommand" }
);

export interface CommandSchemaIssue {
  path: string;
  message: string;
}

const compiledDocumentCommand = TypeCompiler.Compile(DocumentCommandSchema);

export function checkDocumentCommand(value: unknown):
  | { valid: true; command: DocumentCommand }
  | { valid: false; issues: CommandSchemaIssue[] } {
  if (compiledDocumentCommand.Check(value)) return { valid: true, command: value as DocumentCommand };
  return {
    valid: false,
    issues: [...compiledDocumentCommand.Errors(value)].map((error) => ({
      path: error.path || "/",
      message: error.message
    }))
  };
}
