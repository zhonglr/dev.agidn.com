import type { LayoutNode } from "@agidn/document-schema";

export type LayoutKind = LayoutNode["layout"];

export const LAYOUT_KINDS: readonly LayoutKind[] = [
  "section",
  "container",
  "stack",
  "row",
  "grid",
  "overlay"
];

export function createLayoutNode(layout: LayoutKind): LayoutNode {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const common = {
    id: `layout_${layout}_${suffix}`,
    kind: "layout" as const,
    layout,
    children: []
  };
  switch (layout) {
    case "section":
      return common;
    case "container":
      return { ...common, width: "lg" };
    case "stack":
      return { ...common, gapToken: "spacing.md", align: "stretch" };
    case "row":
      return { ...common, gapToken: "spacing.md", align: "center" };
    case "grid":
      return {
        ...common,
        gapToken: "spacing.md",
        columns: { mobile: 1, tablet: 2, desktop: 3 }
      };
    case "overlay":
      return {
        ...common,
        overlay: {
          purpose: "content-overlay",
          anchor: "center",
          boundary: "parent",
          offsetToken: "spacing.sm",
          collision: "shift"
        }
      };
  }
}
