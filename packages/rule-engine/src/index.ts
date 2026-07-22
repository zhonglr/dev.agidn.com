import type { ComponentDefinition, ComponentRegistry, PropDefinition } from "@agidn/component-registry";
import { hasToken, type TokenRegistry, type TokenType } from "@agidn/design-tokens";
import { checkPageDocument, visitNodes, type ComponentNode, type PageDocument, type PageNode } from "@agidn/document-schema";

export type ViolationCode =
  | "COMMAND_INVALID"
  | "COMMAND_TARGET_INVALID"
  | "SCHEMA_INVALID"
  | "DUPLICATE_NODE_ID"
  | "RAW_COLOR_FORBIDDEN"
  | "RAW_SPACING_FORBIDDEN"
  | "RAW_STYLE_FORBIDDEN"
  | "ABSOLUTE_POSITION_FORBIDDEN"
  | "UNKNOWN_COMPONENT"
  | "UNKNOWN_PROP"
  | "INVALID_PROP_VALUE"
  | "INVALID_SLOT"
  | "INVALID_SLOT_CONTENT"
  | "REQUIRED_SLOT_MISSING"
  | "MISSING_RESPONSIVE_RULE"
  | "INVALID_OVERLAY"
  | "ACCESSIBLE_NAME_REQUIRED"
  | "UNKNOWN_ACTION"
  | "INVALID_ACTION_ARGUMENT"
  | "UNKNOWN_VARIANT"
  | "UNKNOWN_STATE"
  | "UNKNOWN_TOKEN"
  | "TOKEN_TYPE_MISMATCH"
  | "INVALID_LAYOUT_NESTING"
  | "LAYOUT_DEPTH_EXCEEDED";

export interface RuleSuggestion {
  description: string;
  command?: Record<string, unknown>;
  tokenRefs?: string[];
}

export interface RuleViolation {
  code: ViolationCode;
  nodeId?: string | undefined;
  path?: string | undefined;
  severity: "error";
  message: string;
  suggestions: RuleSuggestion[];
  approvalAllowed: false;
}

export interface RuleContext {
  components: ComponentRegistry;
  tokens: TokenRegistry;
  actions?: {
    actions: Record<string, {
      arguments?: Record<string, "string" | "number" | "boolean">;
    }>;
  };
  maxLayoutDepth?: number;
}

export interface ValidationResult {
  valid: boolean;
  violations: RuleViolation[];
}

const forbiddenPositionKeys = new Set(["position", "x", "y", "top", "right", "bottom", "left", "inset", "zIndex"]);
const forbiddenStyleKeys = new Set(["style", "className", "css", "sx"]);
const colorKeys = new Set(["color", "background", "backgroundColor", "borderColor", "fill", "stroke"]);
const spacingKeys = new Set(["gap", "padding", "margin", "width", "height"]);

function violation(code: ViolationCode, message: string, details: Partial<RuleViolation> = {}): RuleViolation {
  return { code, severity: "error", message, suggestions: [], approvalAllowed: false, ...details };
}

function rawValueViolations(value: unknown, nodeId?: string, path = ""): RuleViolation[] {
  if (value === null || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  const currentNodeId = typeof object.id === "string" ? object.id : nodeId;
  const issues: RuleViolation[] = [];
  for (const [key, entry] of Object.entries(object)) {
    const entryPath = `${path}/${key}`;
    if (key === "tokens") continue;
    if (forbiddenPositionKeys.has(key)) {
      issues.push(violation("ABSOLUTE_POSITION_FORBIDDEN", `Normal nodes cannot set '${key}'; use a controlled Overlay.`, {
        nodeId: currentNodeId, path: entryPath,
        suggestions: [{ description: "Use an Overlay with a purpose, anchor, boundary and token offset." }]
      }));
      continue;
    }
    if (forbiddenStyleKeys.has(key)) {
      issues.push(violation("RAW_STYLE_FORBIDDEN", `Arbitrary style field '${key}' is not allowed.`, {
        nodeId: currentNodeId, path: entryPath,
        suggestions: [{ description: "Use a registered component variant or design token." }]
      }));
      continue;
    }
    if (colorKeys.has(key)) {
      issues.push(violation("RAW_COLOR_FORBIDDEN", `Raw color property '${key}' is not allowed.`, {
        nodeId: currentNodeId, path: entryPath,
        suggestions: [{ description: "Use a color token reference.", tokenRefs: ["color.action.primary", "color.text.default"] }]
      }));
      continue;
    }
    if (spacingKeys.has(key) && (typeof entry === "number" || (typeof entry === "string" && /(?:px|rem|em|vh|vw|%)$/.test(entry)))) {
      issues.push(violation("RAW_SPACING_FORBIDDEN", `Raw size or spacing property '${key}' is not allowed.`, {
        nodeId: currentNodeId, path: entryPath,
        suggestions: [{ description: "Use a spacing or size token reference.", tokenRefs: ["spacing.sm", "spacing.md", "spacing.lg"] }]
      }));
      continue;
    }
    if (/(?:gap|offset|spacing)Token$/i.test(key) && (typeof entry !== "string" || !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(entry))) {
      issues.push(violation("RAW_SPACING_FORBIDDEN", `Raw spacing in '${key}' is not allowed.`, {
        nodeId: currentNodeId, path: entryPath,
        suggestions: [{ description: "Use a registered spacing token reference.", tokenRefs: ["spacing.sm", "spacing.md", "spacing.lg"] }]
      }));
      continue;
    }
    issues.push(...rawValueViolations(entry, currentNodeId, entryPath));
  }
  return issues;
}

function valueMatchesProp(value: unknown, prop: PropDefinition): boolean {
  if (prop.type === "string") return typeof value === "string";
  if (prop.type === "boolean") return typeof value === "boolean";
  if (prop.type === "number") return typeof value === "number" && Number.isFinite(value);
  return (typeof value === "string" || typeof value === "number") && (prop.values?.includes(value) ?? false);
}

function valueMatchesArgument(value: unknown, expectedType: "string" | "number" | "boolean"): boolean {
  if (expectedType === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === expectedType;
}

function validateComponent(node: ComponentNode, definition: ComponentDefinition | undefined, context: RuleContext): RuleViolation[] {
  if (!definition) {
    return [violation("UNKNOWN_COMPONENT", `Component '${node.componentRef}' is not registered.`, {
      nodeId: node.id,
      suggestions: [{ description: "Choose a component from the registered catalog." }]
    })];
  }

  const issues: RuleViolation[] = [];
  for (const [name, value] of Object.entries(node.props ?? {})) {
    const prop = definition.props[name];
    if (!prop) {
      issues.push(violation("UNKNOWN_PROP", `Prop '${name}' is not registered for ${definition.name}.`, { nodeId: node.id }));
    } else if (!valueMatchesProp(value, prop)) {
      issues.push(violation("INVALID_PROP_VALUE", `Prop '${name}' has an invalid value for ${definition.name}.`, { nodeId: node.id }));
    }
  }
  for (const [name, prop] of Object.entries(definition.props)) {
    if (prop.required && node.props?.[name] === undefined) {
      issues.push(violation("INVALID_PROP_VALUE", `Required prop '${name}' is missing from ${definition.name}.`, { nodeId: node.id }));
    }
  }
  if (node.variant && !definition.variants.includes(node.variant)) {
    issues.push(violation("UNKNOWN_VARIANT", `Variant '${node.variant}' is not registered for ${definition.name}.`, {
      nodeId: node.id,
      suggestions: [{ description: `Use one of: ${definition.variants.join(", ")}.` }]
    }));
  }
  if (node.state && !definition.states.includes(node.state)) {
    issues.push(violation("UNKNOWN_STATE", `State '${node.state}' is not registered for ${definition.name}.`, { nodeId: node.id }));
  }
  for (const [slotName, children] of Object.entries(node.slots ?? {})) {
    const slot = definition.slots[slotName];
    if (!slot) {
      issues.push(violation("INVALID_SLOT", `Slot '${slotName}' is not registered for ${definition.name}.`, { nodeId: node.id }));
      continue;
    }
    if ((slot.minItems !== undefined && children.length < slot.minItems) || (slot.maxItems !== undefined && children.length > slot.maxItems)) {
      issues.push(violation("INVALID_SLOT_CONTENT", `Slot '${slotName}' has an invalid number of children.`, { nodeId: node.id }));
    }
    if (slot.accepts && !slot.accepts.includes("*")) {
      for (const child of children) {
        const accepted = child.kind === "component" && slot.accepts.includes(child.componentRef);
        if (!accepted) issues.push(violation("INVALID_SLOT_CONTENT", `Slot '${slotName}' does not accept ${child.kind === "component" ? child.componentRef : child.layout}.`, { nodeId: child.id }));
      }
    }
  }
  for (const [slotName, slot] of Object.entries(definition.slots)) {
    if (slot.required && (node.slots?.[slotName]?.length ?? 0) === 0) {
      issues.push(violation("REQUIRED_SLOT_MISSING", `Required slot '${slotName}' is empty on ${definition.name}.`, { nodeId: node.id }));
    }
  }
  const needsLabel = definition.accessibleName === "always" || (definition.accessibleName === "when-icon-only" && node.props?.iconOnly === true);
  if (needsLabel && !node.accessibility?.label) {
    issues.push(violation("ACCESSIBLE_NAME_REQUIRED", `${definition.name} requires an accessible name.`, {
      nodeId: node.id,
      suggestions: [{ description: "Set accessibility.label to a concise user-facing name." }]
    }));
  }
  for (const [property, reference] of Object.entries(node.tokens ?? {})) {
    const expectedType: TokenType | undefined = property.toLowerCase().includes("color") ? "color" : property.toLowerCase().includes("spacing") ? "spacing" : undefined;
    if (!hasToken(context.tokens, reference)) {
      issues.push(violation("UNKNOWN_TOKEN", `Token '${reference}' is not registered.`, { nodeId: node.id }));
    } else if (expectedType && !hasToken(context.tokens, reference, expectedType)) {
      issues.push(violation("TOKEN_TYPE_MISMATCH", `Token '${reference}' cannot be used for '${property}'.`, { nodeId: node.id }));
    }
  }
  if (context.actions) {
    for (const interaction of node.interactions ?? []) {
      const action = context.actions.actions[interaction.actionRef];
      if (!action) {
        issues.push(violation("UNKNOWN_ACTION", `Action '${interaction.actionRef}' is not registered.`, {
          nodeId: node.id,
          suggestions: [{ description: "Choose an action from the registered catalog." }]
        }));
        continue;
      }
      const suppliedArguments = interaction.arguments ?? {};
      for (const [name, expectedType] of Object.entries(action.arguments ?? {})) {
        if (!(name in suppliedArguments)) {
          issues.push(violation("INVALID_ACTION_ARGUMENT", `Action '${interaction.actionRef}' requires argument '${name}'.`, { nodeId: node.id }));
        } else if (!valueMatchesArgument(suppliedArguments[name], expectedType)) {
          issues.push(violation("INVALID_ACTION_ARGUMENT", `Argument '${name}' for action '${interaction.actionRef}' must be ${expectedType}.`, { nodeId: node.id }));
        }
      }
      for (const name of Object.keys(suppliedArguments)) {
        if (!(name in (action.arguments ?? {}))) {
          issues.push(violation("INVALID_ACTION_ARGUMENT", `Argument '${name}' is not registered for action '${interaction.actionRef}'.`, { nodeId: node.id }));
        }
      }
    }
  }
  return issues;
}

function semanticViolations(document: PageDocument, context: RuleContext): RuleViolation[] {
  const issues: RuleViolation[] = [];
  const ids = new Set<string>();
  const maxDepth = context.maxLayoutDepth ?? 8;

  const walk = (node: PageNode, parent: PageNode | undefined, layoutDepth: number): void => {
    if (ids.has(node.id)) issues.push(violation("DUPLICATE_NODE_ID", `Node id '${node.id}' is duplicated.`, { nodeId: node.id }));
    ids.add(node.id);
    if (node.kind === "component") {
      issues.push(...validateComponent(node, context.components.components[node.componentRef], context));
      Object.values(node.slots ?? {}).flat().forEach((child) => walk(child, node, layoutDepth));
      return;
    }
    const nextDepth = layoutDepth + 1;
    if (nextDepth > maxDepth) issues.push(violation("LAYOUT_DEPTH_EXCEEDED", `Layout depth exceeds ${maxDepth}.`, { nodeId: node.id }));
    if (node.layout === "section" && parent?.kind === "layout" && parent.layout !== "overlay") {
      issues.push(violation("INVALID_LAYOUT_NESTING", "Section cannot be nested inside a normal layout node.", { nodeId: node.id }));
    }
    if (node.layout === "container" && parent?.kind === "layout" && !["section", "overlay"].includes(parent.layout)) {
      issues.push(violation("INVALID_LAYOUT_NESTING", "Container must be placed directly in a Section or controlled Overlay.", { nodeId: node.id }));
    }
    if (node.layout === "grid") {
      const modes = node.columns;
      if (!modes?.mobile || !modes.tablet || !modes.desktop) {
        issues.push(violation("MISSING_RESPONSIVE_RULE", "Grid must define mobile, tablet and desktop columns.", {
          nodeId: node.id,
          suggestions: [{ description: "Define all semantic modes; mobile normally uses one column." }]
        }));
      }
    }
    if ((node.layout === "overlay" && !node.overlay) || (node.layout !== "overlay" && node.overlay)) {
      issues.push(violation("INVALID_OVERLAY", "Overlay metadata is required only on overlay layout nodes.", {
        nodeId: node.id,
        suggestions: [{ description: "Declare purpose, anchor, boundary and offsetToken on an Overlay." }]
      }));
    }
    if (node.gapToken && !hasToken(context.tokens, node.gapToken, "spacing")) {
      issues.push(violation(hasToken(context.tokens, node.gapToken) ? "TOKEN_TYPE_MISMATCH" : "UNKNOWN_TOKEN", `Gap token '${node.gapToken}' must be a registered spacing token.`, { nodeId: node.id }));
    }
    if (node.overlay && !hasToken(context.tokens, node.overlay.offsetToken, "spacing")) {
      issues.push(violation(hasToken(context.tokens, node.overlay.offsetToken) ? "TOKEN_TYPE_MISMATCH" : "UNKNOWN_TOKEN", `Overlay offset '${node.overlay.offsetToken}' must be a registered spacing token.`, { nodeId: node.id }));
    }
    node.children.forEach((child) => walk(child, node, nextDepth));
  };
  document.children.forEach((node) => walk(node, undefined, 0));
  return issues;
}

export function validateDocument(value: unknown, context: RuleContext): ValidationResult {
  // Scan first so forbidden escape hatches receive domain errors instead of generic schema errors.
  const rawIssues: RuleViolation[] = [];
  if (value !== null && typeof value === "object") {
    const candidate = value as { children?: unknown[] };
    const scanNode = (entry: unknown): void => {
      if (entry === null || typeof entry !== "object") return;
      const node = entry as Record<string, unknown>;
      rawIssues.push(...rawValueViolations(node, typeof node.id === "string" ? node.id : undefined));
    };
    (candidate.children ?? []).forEach(scanNode);
  }
  if (rawIssues.length > 0) return { valid: false, violations: rawIssues };

  const shape = checkPageDocument(value);
  if (!shape.valid) {
    return {
      valid: false,
      violations: shape.issues.map((issue) => violation("SCHEMA_INVALID", issue.message, { path: issue.path }))
    };
  }
  const violations = semanticViolations(shape.document, context);
  return { valid: violations.length === 0, violations };
}

export function collectDocumentReferences(document: PageDocument): { components: Set<string>; tokens: Set<string>; actions: Set<string> } {
  const components = new Set<string>();
  const tokens = new Set<string>();
  const actions = new Set<string>();
  visitNodes(document, (node) => {
    if (node.kind === "layout") {
      if (node.gapToken) tokens.add(node.gapToken);
      if (node.overlay) tokens.add(node.overlay.offsetToken);
    } else {
      components.add(node.componentRef);
      Object.values(node.tokens ?? {}).forEach((reference) => tokens.add(reference));
      node.interactions?.forEach((interaction) => actions.add(interaction.actionRef));
    }
  });
  return { components, tokens, actions };
}
