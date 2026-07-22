export type PropType = "string" | "boolean" | "number" | "enum";

export interface PropDefinition {
  type: PropType;
  required?: boolean;
  values?: readonly (string | number)[];
}

export interface SlotDefinition {
  required?: boolean;
  accepts?: readonly string[];
  minItems?: number;
  maxItems?: number;
}

export interface ComponentDefinition {
  name: string;
  version: string;
  source: string;
  roles: readonly string[];
  props: Readonly<Record<string, PropDefinition>>;
  slots: Readonly<Record<string, SlotDefinition>>;
  variants: readonly string[];
  states: readonly string[];
  accessibleName?: "always" | "when-icon-only";
}

export interface ComponentRegistry {
  version: string;
  components: Record<string, ComponentDefinition>;
}

export function defineComponent(definition: ComponentDefinition): ComponentDefinition {
  return Object.freeze(definition);
}

export function createComponentRegistry(definitions: readonly ComponentDefinition[], version = "1.0.0"): ComponentRegistry {
  const components = Object.fromEntries(definitions.map((definition) => [definition.name, definition]));
  if (Object.keys(components).length !== definitions.length) throw new Error("Component names must be unique");
  return { version, components };
}

export function selectComponents(registry: ComponentRegistry, references: Iterable<string>): ComponentRegistry {
  const components: Record<string, ComponentDefinition> = {};
  for (const reference of [...new Set(references)].sort()) {
    const definition = registry.components[reference];
    if (definition) components[reference] = definition;
  }
  return { version: registry.version, components };
}
