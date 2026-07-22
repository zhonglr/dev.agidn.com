import { Type } from "@sinclair/typebox";
import { ProtocolVersionSchema } from "./common.js";

const PropDefinitionSchema = Type.Object(
  {
    type: Type.Union([Type.Literal("string"), Type.Literal("boolean"), Type.Literal("number"), Type.Literal("enum")]),
    required: Type.Optional(Type.Boolean()),
    values: Type.Optional(Type.Array(Type.Union([Type.String(), Type.Number()])))
  },
  { additionalProperties: false }
);

const SlotDefinitionSchema = Type.Object(
  {
    required: Type.Optional(Type.Boolean()),
    accepts: Type.Optional(Type.Array(Type.String())),
    minItems: Type.Optional(Type.Integer({ minimum: 0 })),
    maxItems: Type.Optional(Type.Integer({ minimum: 0 }))
  },
  { additionalProperties: false }
);

const ComponentDefinitionSchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    version: Type.String({ minLength: 1 }),
    source: Type.String({ minLength: 1 }),
    roles: Type.Array(Type.String()),
    props: Type.Record(Type.String(), PropDefinitionSchema),
    slots: Type.Record(Type.String(), SlotDefinitionSchema),
    variants: Type.Array(Type.String()),
    states: Type.Array(Type.String()),
    accessibleName: Type.Optional(Type.Union([Type.Literal("always"), Type.Literal("when-icon-only")]))
  },
  { additionalProperties: false }
);

const ComponentRegistrySchema = Type.Object(
  {
    version: Type.String({ minLength: 1 }),
    components: Type.Record(Type.String(), ComponentDefinitionSchema)
  },
  { additionalProperties: false }
);

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
    arguments: Type.Optional(Type.Record(Type.String(), Type.String()))
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
    constraints: Type.Unknown()
  },
  { additionalProperties: false }
);
