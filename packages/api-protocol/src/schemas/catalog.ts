import { Type } from "@sinclair/typebox";
import { ProtocolVersionSchema } from "./common.js";

const LocalizedLabelSchema = Type.Union([
  Type.String({ minLength: 1 }),
  Type.Record(Type.String({ minLength: 2 }), Type.String({ minLength: 1 }))
]);

const PropDefinitionSchema = Type.Object(
  {
    type: Type.Union([Type.Literal("string"), Type.Literal("boolean"), Type.Literal("number"), Type.Literal("enum")]),
    displayName: Type.Optional(LocalizedLabelSchema),
    required: Type.Optional(Type.Boolean()),
    values: Type.Optional(Type.Array(Type.Union([Type.String(), Type.Number()]))),
    valueDisplayNames: Type.Optional(Type.Record(Type.String(), LocalizedLabelSchema))
  },
  { additionalProperties: false }
);

const SlotDefinitionSchema = Type.Object(
  {
    displayName: Type.Optional(LocalizedLabelSchema),
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
    displayName: Type.Optional(LocalizedLabelSchema),
    category: Type.Optional(Type.String({ minLength: 1 })),
    categoryDisplayName: Type.Optional(LocalizedLabelSchema),
    version: Type.String({ minLength: 1 }),
    source: Type.String({ minLength: 1 }),
    roles: Type.Array(Type.String()),
    props: Type.Record(Type.String(), PropDefinitionSchema),
    slots: Type.Record(Type.String(), SlotDefinitionSchema),
    variants: Type.Array(Type.String()),
    variantDisplayNames: Type.Optional(Type.Record(Type.String(), LocalizedLabelSchema)),
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
    constraints: Type.Unknown()
  },
  { additionalProperties: false }
);
