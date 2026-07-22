import { Type, type TSchema } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";

const IdentifierSchema = Type.String({ minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$" });
const VersionSchema = Type.String({ minLength: 1 });

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
    accepts: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    minItems: Type.Optional(Type.Integer({ minimum: 0 })),
    maxItems: Type.Optional(Type.Integer({ minimum: 0 }))
  },
  { additionalProperties: false }
);

const ComponentDefinitionSchema = Type.Object(
  {
    name: IdentifierSchema,
    version: VersionSchema,
    source: Type.String({ minLength: 1 }),
    roles: Type.Array(IdentifierSchema),
    props: Type.Record(Type.String(), PropDefinitionSchema),
    slots: Type.Record(Type.String(), SlotDefinitionSchema),
    variants: Type.Array(IdentifierSchema),
    states: Type.Array(IdentifierSchema),
    accessibleName: Type.Optional(Type.Union([Type.Literal("always"), Type.Literal("when-icon-only")]))
  },
  { additionalProperties: false }
);

export const ComponentRegistrySchema = Type.Object(
  {
    version: VersionSchema,
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
    value: Type.String({ minLength: 1 }),
    description: Type.Optional(Type.String())
  },
  { additionalProperties: false }
);

export const TokenRegistrySchema = Type.Object(
  {
    version: VersionSchema,
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

export const ActionRegistrySchema = Type.Object(
  {
    version: VersionSchema,
    actions: Type.Record(Type.String(), ActionDefinitionSchema),
    dataSources: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
  },
  { additionalProperties: false }
);

export const PolicyRegistrySchema = Type.Object(
  {
    version: VersionSchema,
    breakpoints: Type.Object(
      { mobile: Type.Number({ minimum: 0 }), tablet: Type.Number({ minimum: 0 }), desktop: Type.Number({ minimum: 0 }) },
      { additionalProperties: false }
    ),
    containerWidths: Type.Array(Type.Union([Type.Literal("sm"), Type.Literal("md"), Type.Literal("lg"), Type.Literal("full")])),
    spacingTokens: Type.Array(Type.String({ minLength: 1 })),
    alignments: Type.Array(Type.Union([Type.Literal("start"), Type.Literal("center"), Type.Literal("end"), Type.Literal("stretch")])),
    gridColumns: Type.Array(Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3), Type.Literal(4), Type.Literal(6), Type.Literal(12)])),
    maxLayoutDepth: Type.Integer({ minimum: 1 }),
    overlay: Type.Object(
      {
        purposes: Type.Array(Type.Union([Type.Literal("badge"), Type.Literal("decoration"), Type.Literal("content-overlay")])),
        boundaries: Type.Array(Type.Union([Type.Literal("parent"), Type.Literal("viewport")]))
      },
      { additionalProperties: false }
    )
  },
  { additionalProperties: false }
);

const ConstraintDefinitionSchema = Type.Object(
  {
    code: IdentifierSchema,
    description: Type.String({ minLength: 1 }),
    approvalAllowed: Type.Boolean()
  },
  { additionalProperties: false }
);

export const ConstraintRegistrySchema = Type.Object(
  {
    version: VersionSchema,
    constraints: Type.Array(ConstraintDefinitionSchema)
  },
  { additionalProperties: false }
);

export interface ProjectConfigIssue {
  path: string;
  message: string;
}

export function checkProjectConfig(schema: TSchema, value: unknown): ProjectConfigIssue[] {
  const compiled = TypeCompiler.Compile(schema);
  if (compiled.Check(value)) return [];
  return [...compiled.Errors(value)].map((error) => ({ path: error.path || "/", message: error.message }));
}
