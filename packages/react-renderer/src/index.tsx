import type { CSSProperties, ComponentType, ReactNode } from "react";
import type { TokenRegistry } from "@agidn/design-tokens";
import type { ComponentNode, LayoutNode, PageDocument, PageNode } from "@agidn/document-schema";
import {
  instantiateComposite,
  type CompositeAsset
} from "@agidn/project-assets";

export interface RuntimeComponentProps {
  node: ComponentNode;
  slots: Readonly<Record<string, ReactNode[]>>;
  style: CSSProperties;
  hostProps: {
    "data-node-id"?: string;
    "data-node-kind"?: "component";
    "data-component-ref"?: string;
    "data-role"?: string;
    "aria-label"?: string;
    "aria-describedby"?: string;
    "aria-hidden"?: true;
    "data-visible-mobile"?: "false";
    "data-visible-tablet"?: "false";
    "data-visible-desktop"?: "false";
  };
  onEvent: (event: string) => void;
}

export type RuntimeComponentRegistry = Readonly<Record<string, ComponentType<RuntimeComponentProps>>>;

export interface PageRendererProps {
  document: PageDocument;
  tokens: TokenRegistry;
  components: RuntimeComponentRegistry;
  composites?: Readonly<Record<string, CompositeAsset>>;
  onAction?: (actionRef: string, argumentsValue: Record<string, unknown>, node: ComponentNode) => void;
}

function tokenValue(tokens: TokenRegistry, reference: string | undefined): string | undefined {
  return reference ? tokens.tokens[reference]?.value : undefined;
}

function componentStyle(node: ComponentNode, tokens: TokenRegistry): CSSProperties {
  const style = placementStyle(node);
  for (const [property, reference] of Object.entries(node.styleBindings ?? {})) {
    const value = tokenValue(tokens, reference);
    if (!value) continue;
    if (/surface|background/i.test(property)) style.backgroundColor = value;
    else if (/textColor|foreground/i.test(property)) style.color = value;
    else if (/color/i.test(property)) style.color = value;
    else if (/radius/i.test(property)) style.borderRadius = value;
    else if (/shadow/i.test(property)) style.boxShadow = value;
    else if (/typography/i.test(property)) style.font = value;
  }
  return style;
}

function placementStyle(node: PageNode): CSSProperties {
  const style: CSSProperties & Record<`--agidn-${string}`, string | number | undefined> = {};
  if (node.placement?.width === "fit") style.width = "fit-content";
  if (node.placement?.width === "fill") style.width = "100%";
  if (node.placement?.grow) style.flexGrow = 1;
  if (node.placement?.alignSelf) {
    style.alignSelf =
      node.placement.alignSelf === "auto"
        ? "auto"
        : node.placement.alignSelf === "start"
          ? "flex-start"
          : node.placement.alignSelf === "end"
            ? "flex-end"
            : node.placement.alignSelf;
  }
  if (node.placement?.gridSpan?.mobile) style["--agidn-grid-span-mobile"] = node.placement.gridSpan.mobile;
  if (node.placement?.gridSpan?.tablet) style["--agidn-grid-span-tablet"] = node.placement.gridSpan.tablet;
  if (node.placement?.gridSpan?.desktop) style["--agidn-grid-span-desktop"] = node.placement.gridSpan.desktop;
  return style;
}

function visibilityAttributes(node: PageNode) {
  return {
    ...(node.visibility?.mobile === false ? { "data-visible-mobile": "false" as const } : {}),
    ...(node.visibility?.tablet === false ? { "data-visible-tablet": "false" as const } : {}),
    ...(node.visibility?.desktop === false ? { "data-visible-desktop": "false" as const } : {})
  };
}

function accessibilityAttributes(node: ComponentNode) {
  return {
    ...(node.accessibility?.label ? { "aria-label": node.accessibility.label } : {}),
    ...(node.accessibility?.describedBy
      ? { "aria-describedby": node.accessibility.describedBy }
      : {}),
    ...(node.accessibility?.decorative === true ? { "aria-hidden": true as const } : {})
  };
}

function layoutStyle(node: LayoutNode, tokens: TokenRegistry): CSSProperties {
  const gap = tokenValue(tokens, node.gapToken);
  const style = placementStyle(node) as CSSProperties & Record<`--agidn-${string}`, string | number | undefined>;
  if (gap) style.gap = gap;
  if (node.align) style.alignItems = node.align === "start" ? "flex-start" : node.align === "end" ? "flex-end" : node.align;
  if (node.layout === "grid") {
    style["--agidn-grid-mobile"] = node.columns?.mobile ?? 1;
    style["--agidn-grid-tablet"] = node.columns?.tablet ?? node.columns?.mobile ?? 1;
    style["--agidn-grid-desktop"] = node.columns?.desktop ?? node.columns?.tablet ?? 1;
  }
  if (node.layout === "overlay" && node.overlay) {
    style.position = node.overlay.boundary === "viewport" ? "fixed" : "absolute";
    const offset = tokenValue(tokens, node.overlay.offsetToken) ?? "0";
    if (node.overlay.anchor.includes("top")) style.top = offset;
    if (node.overlay.anchor.includes("bottom")) style.bottom = offset;
    if (node.overlay.anchor.includes("start")) style.left = offset;
    if (node.overlay.anchor.includes("end")) style.right = offset;
    if (node.overlay.anchor === "center") {
      style.inset = "50% auto auto 50%";
      style.transform = "translate(-50%, -50%)";
    }
  }
  return style;
}

function collectNodeIds(nodes: readonly PageNode[]): Set<string> {
  const result = new Set<string>();
  const visit = (node: PageNode): void => {
    result.add(node.id);
    (node.kind === "layout"
      ? node.children
      : Object.values(node.slots ?? {}).flat()
    ).forEach(visit);
  };
  nodes.forEach(visit);
  return result;
}

export function PageRenderer({
  document,
  tokens,
  components,
  composites = {},
  onAction
}: PageRendererProps) {
  const renderNode = (
    node: PageNode,
    selectableNodeIds?: ReadonlySet<string>,
    boundary?: ComponentNode
  ): ReactNode => {
    const selectable = selectableNodeIds === undefined || selectableNodeIds.has(node.id);
    const identity = boundary ?? (selectable ? node : undefined);
    const visualNode = boundary ?? node;

    if (node.kind === "layout") {
      const children = node.children.map((child) => renderNode(child, selectableNodeIds));
      const className = `agidn-layout agidn-layout--${node.layout}${node.width ? ` agidn-layout--width-${node.width}` : ""}`;
      const attributes = {
        className,
        style: {
          ...layoutStyle(node, tokens),
          ...(boundary ? componentStyle(boundary, tokens) : {})
        },
        ...(identity
          ? {
              "data-node-id": identity.id,
              "data-node-kind": identity.kind,
              ...(identity.kind === "component"
                ? { "data-component-ref": identity.componentRef }
                : {})
            }
          : {}),
        "data-role": visualNode.role,
        ...visibilityAttributes(visualNode)
      };
      return node.layout === "section"
        ? <section key={node.id} {...attributes}>{children}</section>
        : <div key={node.id} {...attributes}>{children}</div>;
    }

    const composite = composites[node.componentRef];
    if (composite) {
      const publicSlotIds =
        selectableNodeIds ??
        collectNodeIds(Object.values(node.slots ?? {}).flat());
      const root = instantiateComposite(
        composite,
        node,
        (templateId) => `${node.id}:${templateId}`
      );
      return renderNode(
        root,
        publicSlotIds,
        identity?.kind === "component" ? identity : undefined
      );
    }

    const RuntimeComponent = components[node.componentRef];
    if (!RuntimeComponent) {
      return (
        <div
          key={node.id}
          className="agidn-component-missing"
          {...(identity
            ? {
                "data-node-id": identity.id,
                "data-node-kind": identity.kind,
                ...(identity.kind === "component"
                  ? { "data-component-ref": identity.componentRef }
                  : {})
              }
            : {})}
        >
          Missing component: {node.componentRef}
        </div>
      );
    }
    const slots = Object.fromEntries(
      Object.entries(node.slots ?? {}).map(([name, children]) => [
        name,
        children.map((child) => renderNode(child, selectableNodeIds))
      ])
    );
    const onEvent: RuntimeComponentProps["onEvent"] = (event) => {
      for (const interaction of node.interactions ?? []) {
        if (interaction.event === event) onAction?.(interaction.actionRef, interaction.arguments ?? {}, node);
      }
    };
    return (
      <RuntimeComponent
        key={node.id}
        node={node}
        slots={slots}
        style={{
          ...componentStyle(node, tokens),
          ...(boundary ? componentStyle(boundary, tokens) : {})
        }}
        hostProps={{
          ...(identity
            ? {
                "data-node-id": identity.id,
                "data-node-kind": "component" as const,
                "data-component-ref":
                  identity.kind === "component"
                    ? identity.componentRef
                    : node.componentRef
              }
            : {}),
          ...(visualNode.role ? { "data-role": visualNode.role } : {}),
          ...accessibilityAttributes(
            visualNode.kind === "component" ? visualNode : node
          ),
          ...visibilityAttributes(visualNode)
        }}
        onEvent={onEvent}
      />
    );
  };

  return (
    <div className="agidn-page" data-document-id={document.id} data-page-role={document.role}>
      {document.children.map((node) => renderNode(node))}
    </div>
  );
}
