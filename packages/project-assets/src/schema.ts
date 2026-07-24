import { Type, type Static } from "@sinclair/typebox";
import {
  LocalizedLabelSchema,
  PropDefinitionSchema,
  SlotDefinitionSchema
} from "@agidn/component-registry";
import {
  IdentifierSchema,
  PageNodeSchema
} from "@agidn/document-schema";

export const PROJECT_ASSET_SCHEMA_VERSION = "2.0.0" as const;

const PublicPropSchema = Type.Object(
  {
    definition: PropDefinitionSchema,
    bindings: Type.Array(
      Type.Object(
        {
          targetNodeId: IdentifierSchema,
          property: IdentifierSchema
        },
        { additionalProperties: false }
      ),
      { minItems: 1 }
    )
  },
  { additionalProperties: false }
);

const PublicSlotSchema = Type.Object(
  {
    definition: SlotDefinitionSchema,
    targetNodeId: IdentifierSchema,
    targetSlot: Type.Optional(IdentifierSchema)
  },
  { additionalProperties: false }
);

const CompositeVariantSchema = Type.Object(
  {
    displayName: LocalizedLabelSchema,
    props: Type.Optional(
      Type.Record(
        Type.String(),
        Type.Union([
          Type.String(),
          Type.Number(),
          Type.Boolean()
        ])
      )
    )
  },
  { additionalProperties: false }
);

export const CompositeAssetSchema = Type.Object(
  {
    id: IdentifierSchema,
    kind: Type.Literal("composite"),
    version: Type.Integer({ minimum: 1 }),
    displayName: LocalizedLabelSchema,
    description: LocalizedLabelSchema,
    root: PageNodeSchema,
    publicProps: Type.Record(Type.String(), PublicPropSchema),
    publicSlots: Type.Record(Type.String(), PublicSlotSchema),
    variants: Type.Record(Type.String(), CompositeVariantSchema),
    editor: Type.Object(
      {
        icon: Type.String({ minLength: 1 }),
        keywords: Type.Array(Type.String()),
        defaultVariant: Type.Optional(IdentifierSchema)
      },
      { additionalProperties: false }
    )
  },
  { additionalProperties: false }
);

export const PatternAssetSchema = Type.Object(
  {
    id: IdentifierSchema,
    kind: Type.Literal("pattern"),
    version: Type.Integer({ minimum: 1 }),
    displayName: LocalizedLabelSchema,
    description: LocalizedLabelSchema,
    category: IdentifierSchema,
    nodes: Type.Array(PageNodeSchema, { minItems: 1 })
  },
  { additionalProperties: false }
);

export const ProjectAssetRegistrySchema = Type.Object(
  {
    schemaVersion: Type.Literal(PROJECT_ASSET_SCHEMA_VERSION),
    composites: Type.Record(Type.String(), CompositeAssetSchema),
    patterns: Type.Record(Type.String(), PatternAssetSchema)
  },
  { additionalProperties: false }
);

export type CompositeAsset = Static<typeof CompositeAssetSchema>;
export type PatternAsset = Static<typeof PatternAssetSchema>;
export type ProjectAssetRegistry = Static<
  typeof ProjectAssetRegistrySchema
>;
