import type { CSSProperties, ComponentType, ReactNode } from "react";
import type { TokenRegistry } from "@agidn/design-tokens";
import type { ComponentNode, LayoutNode, PageDocument, PageNode } from "@agidn/document-schema";

export interface RuntimeComponentProps {
  node: ComponentNode;
  slots: Readonly<Record<string, ReactNode[]>>;
  style: CSSProperties;
  onEvent: (event: "press" | "change" | "submit" | "open" | "close") => void;
}

export type RuntimeComponentRegistry = Readonly<Record<string, ComponentType<RuntimeComponentProps>>>;

export interface PageRendererProps {
  document: PageDocument;
  tokens: TokenRegistry;
  components: RuntimeComponentRegistry;
  onAction?: (actionRef: string, argumentsValue: Record<string, unknown>, node: ComponentNode) => void;
}

function tokenValue(tokens: TokenRegistry, reference: string | undefined): string | undefined {
  return reference ? tokens.tokens[reference]?.value : undefined;
}

function componentStyle(node: ComponentNode, tokens: TokenRegistry): CSSProperties {
  const style: CSSProperties = {};
  for (const [property, reference] of Object.entries(node.tokens ?? {})) {
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

function layoutStyle(node: LayoutNode, tokens: TokenRegistry): CSSProperties {
  const gap = tokenValue(tokens, node.gapToken);
  const style: CSSProperties & Record<`--agidn-${string}`, string | number | undefined> = {};
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

export function PageRenderer({ document, tokens, components, onAction }: PageRendererProps) {
  const renderNode = (node: PageNode): ReactNode => {
    if (node.kind === "layout") {
      const children = node.children.map(renderNode);
      const className = `agidn-layout agidn-layout--${node.layout}${node.width ? ` agidn-layout--width-${node.width}` : ""}`;
      const attributes = {
        className,
        style: layoutStyle(node, tokens),
        "data-node-id": node.id,
        "data-role": node.role
      };
      return node.layout === "section"
        ? <section key={node.id} {...attributes}>{children}</section>
        : <div key={node.id} {...attributes}>{children}</div>;
    }

    const RuntimeComponent = components[node.componentRef];
    if (!RuntimeComponent) {
      return <div key={node.id} className="agidn-component-missing" data-node-id={node.id}>Missing component: {node.componentRef}</div>;
    }
    const slots = Object.fromEntries(
      Object.entries(node.slots ?? {}).map(([name, children]) => [name, children.map(renderNode)])
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
        style={componentStyle(node, tokens)}
        onEvent={onEvent}
      />
    );
  };

  return (
    <div className="agidn-page" data-document-id={document.id} data-page-role={document.role}>
      {document.children.map(renderNode)}
    </div>
  );
}
