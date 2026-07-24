import { Type } from "@sinclair/typebox";
import { ComponentRegistrySchema } from "@agidn/component-registry";
import { ProjectAssetRegistrySchema } from "@agidn/project-assets";
import { ProtocolVersionSchema } from "./common.js";

const TokenDefinitionSchema = Type.Object(
  {
    type: Type.Union([
      Type.Literal("color"),
      Type.Literal("spacing"),
      Type.Literal("radius"),
      Type.Literal("typography"),
      Type.Literal("shadow"),
      Type.Literal("size")
    ]),
    value: Type.String(),
    description: Type.Optional(Type.String())
  },
  { additionalProperties: false }
);

const TokenRegistrySchema = Type.Object(
  {
    version: Type.String({ minLength: 1 }),
    tokens: Type.Record(Type.String(), TokenDefinitionSchema)
  },
  { additionalProperties: false }
);

const ActionDefinitionSchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    description: Type.String(),
    arguments: Type.Optional(
      Type.Record(
        Type.String(),
        Type.Union([Type.Literal("string"), Type.Literal("number"), Type.Literal("boolean")])
      )
    )
  },
  { additionalProperties: false }
);

const ActionRegistrySchema = Type.Object(
  {
    version: Type.String({ minLength: 1 }),
    actions: Type.Record(Type.String(), ActionDefinitionSchema),
    dataSources: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
  },
  { additionalProperties: false }
);

export const GetCatalogResponseSchema = Type.Object(
  {
    protocolVersion: ProtocolVersionSchema,
    ok: Type.Literal(true),
    components: ComponentRegistrySchema,
    tokens: TokenRegistrySchema,
    policies: Type.Unknown(),
    actions: ActionRegistrySchema,
    constraints: Type.Unknown(),
    assets: ProjectAssetRegistrySchema
  },
  { additionalProperties: false }
);
