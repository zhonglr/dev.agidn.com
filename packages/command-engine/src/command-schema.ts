import { Type } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import {
  AccessibilitySchema,
  InteractionSchema,
  OverlaySchema,
  PageNodeSchema,
  PlacementSchema,
  ResponsiveColumnsSchema,
  VisibilitySchema
} from "@agidn/document-schema";
import type { DocumentCommand } from "./command.js";

const identifier = Type.String({ minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$" });
const propertyName = Type.String({ minLength: 1, pattern: "^[A-Za-z][A-Za-z0-9]*$" });
const tokenReference = Type.String({ minLength: 3, pattern: "^[a-z][a-z0-9-]*(?:\\.[a-z][a-z0-9-]*)+$" });
const base = Type.Object({ commandId: identifier, protocolVersion: Type.Literal("2.0.0") });

function command<T extends ReturnType<typeof Type.Object>>(payload: T) {
  return Type.Composite([base, payload], { additionalProperties: false });
}

export const DocumentCommandSchema = Type.Union(
  [
    command(Type.Object({
      type: Type.Literal("node.setLayoutProperty"),
      nodeId: identifier,
      property: Type.Union([
        Type.Literal("width"),
        Type.Literal("gapToken"),
        Type.Literal("align"),
        Type.Literal("columns"),
        Type.Literal("overlay"),
        Type.Literal("position"),
        Type.Literal("x"),
        Type.Literal("y"),
        Type.Literal("top"),
        Type.Literal("right"),
        Type.Literal("bottom"),
        Type.Literal("left"),
        Type.Literal("inset"),
        Type.Literal("zIndex")
      ]),
      value: Type.Union([
        Type.Literal("sm"),
        Type.Literal("md"),
        Type.Literal("lg"),
        Type.Literal("full"),
        Type.Literal("start"),
        Type.Literal("center"),
        Type.Literal("end"),
        Type.Literal("stretch"),
        tokenReference,
        Type.Number(),
        ResponsiveColumnsSchema,
        OverlaySchema,
        Type.Null()
      ])
    })),
    command(Type.Object({ type: Type.Literal("node.setProp"), nodeId: identifier, property: propertyName, value: Type.Unknown() })),
    command(Type.Object({ type: Type.Literal("node.setName"), nodeId: identifier, name: Type.Union([Type.String({ minLength: 1 }), Type.Null()]) })),
    command(Type.Object({ type: Type.Literal("node.setVariant"), nodeId: identifier, variant: Type.Union([identifier, Type.Null()]) })),
    command(Type.Object({ type: Type.Literal("node.setStyleBinding"), nodeId: identifier, property: propertyName, tokenRef: Type.Union([tokenReference, Type.Null()]) })),
    command(Type.Object({ type: Type.Literal("node.setResponsivePolicy"), nodeId: identifier, columns: ResponsiveColumnsSchema })),
    command(Type.Object({ type: Type.Literal("node.setRole"), nodeId: identifier, role: Type.Union([identifier, Type.Null()]) })),
    command(Type.Object({ type: Type.Literal("node.setPlacement"), nodeId: identifier, placement: Type.Union([PlacementSchema, Type.Null()]) })),
    command(Type.Object({ type: Type.Literal("node.setVisibility"), nodeId: identifier, visibility: Type.Union([VisibilitySchema, Type.Null()]) })),
    command(Type.Object({ type: Type.Literal("node.setAccessibility"), nodeId: identifier, accessibility: Type.Union([AccessibilitySchema, Type.Null()]) })),
    command(Type.Object({ type: Type.Literal("node.setInteractions"), nodeId: identifier, interactions: Type.Array(InteractionSchema) })),
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
