import { Type } from "@sinclair/typebox";

export const COMPONENT_REGISTRY_VERSION = "2.0.0" as const;

export const ComponentIdentifierSchema = Type.String({
  minLength: 1,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$"
});
export const LocalizedLabelSchema = Type.Union([
  Type.String({ minLength: 1 }),
  Type.Record(Type.String({ minLength: 2 }), Type.String({ minLength: 1 }))
]);
export const PropDefinitionSchema = Type.Object(
  {
    type: Type.Union([
      Type.Literal("string"),
      Type.Literal("boolean"),
      Type.Literal("number"),
      Type.Literal("enum")
    ]),
    displayName: LocalizedLabelSchema,
    required: Type.Boolean(),
    defaultValue: Type.Optional(
      Type.Union([Type.String(), Type.Number(), Type.Boolean()])
    ),
    values: Type.Optional(Type.Array(Type.Union([Type.String(), Type.Number()]))),
    valueDisplayNames: Type.Optional(Type.Record(Type.String(), LocalizedLabelSchema)),
    editor: Type.Union([
      Type.Literal("text"),
      Type.Literal("textarea"),
      Type.Literal("switch"),
      Type.Literal("number"),
      Type.Literal("select"),
      Type.Literal("url")
    ]),
    validation: Type.Optional(
      Type.Object(
        {
          min: Type.Optional(Type.Number()),
          max: Type.Optional(Type.Number()),
          pattern: Type.Optional(Type.String())
        },
        { additionalProperties: false }
      )
    )
  },
  { additionalProperties: false }
);
export const SlotDefinitionSchema = Type.Object(
  {
    displayName: LocalizedLabelSchema,
    valueType: Type.Literal("nodes"),
    accepts: Type.Array(
      Type.Union([ComponentIdentifierSchema, Type.Literal("*")])
    ),
    required: Type.Boolean(),
    minItems: Type.Integer({ minimum: 0 }),
    maxItems: Type.Optional(Type.Integer({ minimum: 0 }))
  },
  { additionalProperties: false }
);
export const ComponentDefinitionSchema = Type.Object(
  {
    name: ComponentIdentifierSchema,
    version: Type.String({ minLength: 1 }),
    source: Type.String({ minLength: 1 }),
    displayName: LocalizedLabelSchema,
    description: LocalizedLabelSchema,
    category: Type.Union([
      Type.Literal("action"),
      Type.Literal("typography"),
      Type.Literal("media"),
      Type.Literal("surface"),
      Type.Literal("composite")
    ]),
    roles: Type.Array(ComponentIdentifierSchema),
    props: Type.Record(Type.String(), PropDefinitionSchema),
    slots: Type.Record(Type.String(), SlotDefinitionSchema),
    variants: Type.Record(
      Type.String(),
      Type.Object({ displayName: LocalizedLabelSchema }, { additionalProperties: false })
    ),
    tokenSlots: Type.Record(
      Type.String(),
      Type.Object(
        {
          displayName: LocalizedLabelSchema,
          tokenTypes: Type.Array(
            Type.Union([
              Type.Literal("color"),
              Type.Literal("spacing"),
              Type.Literal("radius"),
              Type.Literal("typography"),
              Type.Literal("shadow"),
              Type.Literal("size")
            ])
          )
        },
        { additionalProperties: false }
      )
    ),
    events: Type.Record(
      Type.String(),
      Type.Object({ displayName: LocalizedLabelSchema }, { additionalProperties: false })
    ),
    accessibility: Type.Object(
      {
        accessibleName: Type.Union([
          Type.Literal("none"),
          Type.Literal("always"),
          Type.Literal("when-icon-only")
        ]),
        iconOnlyProp: Type.Optional(ComponentIdentifierSchema)
      },
      { additionalProperties: false }
    ),
    editor: Type.Object(
      {
        icon: Type.String({ minLength: 1 }),
        keywords: Type.Array(Type.String()),
        presets: Type.Record(
          Type.String(),
          Type.Object(
            {
              displayName: LocalizedLabelSchema,
              variant: Type.Optional(ComponentIdentifierSchema),
              props: Type.Optional(
                Type.Record(
                  Type.String(),
                  Type.Union([Type.String(), Type.Number(), Type.Boolean()])
                )
              )
            },
            { additionalProperties: false }
          )
        ),
        defaultPreset: ComponentIdentifierSchema
      },
      { additionalProperties: false }
    )
  },
  { additionalProperties: false }
);
export const ComponentRegistrySchema = Type.Object(
  {
    schemaVersion: Type.Literal(COMPONENT_REGISTRY_VERSION),
    components: Type.Record(Type.String(), ComponentDefinitionSchema)
  },
  { additionalProperties: false }
);

export type LocalizedLabel = string | Readonly<Record<string, string>>;
export type ComponentCategory = "action" | "typography" | "media" | "surface" | "composite";
export type PropType = "string" | "boolean" | "number" | "enum";
export type PropEditor = "text" | "textarea" | "switch" | "number" | "select" | "url";
export type TokenType = "color" | "spacing" | "radius" | "typography" | "shadow" | "size";

export interface PropDefinition {
  type: PropType;
  displayName: LocalizedLabel;
  required: boolean;
  defaultValue?: string | number | boolean;
  values?: readonly (string | number)[];
  valueDisplayNames?: Readonly<Record<string, LocalizedLabel>>;
  editor: PropEditor;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface SlotDefinition {
  displayName: LocalizedLabel;
  valueType: "nodes";
  accepts: readonly string[];
  required: boolean;
  minItems: number;
  maxItems?: number;
}

export interface VariantDefinition {
  displayName: LocalizedLabel;
}

export interface TokenSlotDefinition {
  displayName: LocalizedLabel;
  tokenTypes: readonly TokenType[];
}

export interface ComponentEventDefinition {
  displayName: LocalizedLabel;
}

export interface AccessibilityContract {
  accessibleName: "none" | "always" | "when-icon-only";
  iconOnlyProp?: string;
}

export interface ComponentPreset {
  displayName: LocalizedLabel;
  variant?: string;
  props?: Readonly<Record<string, string | number | boolean>>;
}

export interface ComponentDefinition {
  name: string;
  version: string;
  source: string;
  displayName: LocalizedLabel;
  description: LocalizedLabel;
  category: ComponentCategory;
  roles: readonly string[];
  props: Readonly<Record<string, PropDefinition>>;
  slots: Readonly<Record<string, SlotDefinition>>;
  variants: Readonly<Record<string, VariantDefinition>>;
  tokenSlots: Readonly<Record<string, TokenSlotDefinition>>;
  events: Readonly<Record<string, ComponentEventDefinition>>;
  accessibility: AccessibilityContract;
  editor: {
    icon: string;
    keywords: readonly string[];
    presets: Readonly<Record<string, ComponentPreset>>;
    defaultPreset: string;
  };
}

export interface ComponentRegistry {
  schemaVersion: typeof COMPONENT_REGISTRY_VERSION;
  components: Record<string, ComponentDefinition>;
}

export function defineComponent(definition: ComponentDefinition): ComponentDefinition {
  return Object.freeze(definition);
}

export function createComponentRegistry(definitions: readonly ComponentDefinition[]): ComponentRegistry {
  const components = Object.fromEntries(definitions.map((definition) => [definition.name, definition]));
  if (Object.keys(components).length !== definitions.length) throw new Error("Component names must be unique");
  return { schemaVersion: COMPONENT_REGISTRY_VERSION, components };
}

export function selectComponents(registry: ComponentRegistry, references: Iterable<string>): ComponentRegistry {
  const components: Record<string, ComponentDefinition> = {};
  for (const reference of [...new Set(references)].sort()) {
    const definition = registry.components[reference];
    if (definition) components[reference] = definition;
  }
  return { schemaVersion: COMPONENT_REGISTRY_VERSION, components };
}
