import { Type, type Static } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { IdentifierSchema } from "@agidn/document-schema";
import {
  CompositeAssetSchema,
  PatternAssetSchema
} from "./schema.js";

const commandBase = Type.Object({
  protocolVersion: Type.Literal("2.0.0"),
  commandId: IdentifierSchema
});

function command<T extends ReturnType<typeof Type.Object>>(payload: T) {
  return Type.Composite([commandBase, payload], {
    additionalProperties: false
  });
}

export const ProjectAssetCommandSchema = Type.Union(
  [
    command(
      Type.Object({
        type: Type.Literal("asset.composite.upsert"),
        asset: CompositeAssetSchema
      })
    ),
    command(
      Type.Object({
        type: Type.Literal("asset.pattern.upsert"),
        asset: PatternAssetSchema
      })
    ),
    command(
      Type.Object({
        type: Type.Literal("asset.remove"),
        assetType: Type.Union([
          Type.Literal("composite"),
          Type.Literal("pattern")
        ]),
        assetId: IdentifierSchema
      })
    )
  ],
  { $id: "ProjectAssetCommand" }
);

export const ProjectAssetPatchOperationSchema = Type.Union([
  Type.Object(
    {
      op: Type.Literal("asset.upsert"),
      assetType: Type.Union([
        Type.Literal("composite"),
        Type.Literal("pattern")
      ]),
      assetId: IdentifierSchema,
      version: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      op: Type.Literal("asset.remove"),
      assetType: Type.Union([
        Type.Literal("composite"),
        Type.Literal("pattern")
      ]),
      assetId: IdentifierSchema
    },
    { additionalProperties: false }
  )
]);

export const ProjectAssetPatchSchema = Type.Object(
  {
    protocolVersion: Type.Literal("2.0.0"),
    commandId: IdentifierSchema,
    operations: Type.Array(ProjectAssetPatchOperationSchema, {
      minItems: 1
    })
  },
  { $id: "ProjectAssetPatch", additionalProperties: false }
);

export type ProjectAssetCommand = Static<typeof ProjectAssetCommandSchema>;
export type ProjectAssetPatch = Static<typeof ProjectAssetPatchSchema>;

const compiledCommand = TypeCompiler.Compile(ProjectAssetCommandSchema);
const compiledPatch = TypeCompiler.Compile(ProjectAssetPatchSchema);

export function checkProjectAssetCommand(value: unknown):
  | { valid: true; command: ProjectAssetCommand }
  | { valid: false; issues: Array<{ path: string; message: string }> } {
  if (compiledCommand.Check(value)) {
    return {
      valid: true,
      command: structuredClone(value as ProjectAssetCommand)
    };
  }
  return {
    valid: false,
    issues: [...compiledCommand.Errors(value)].map((error) => ({
      path: error.path || "/",
      message: error.message
    }))
  };
}

export function checkProjectAssetPatch(
  value: unknown
): value is ProjectAssetPatch {
  return compiledPatch.Check(value);
}
