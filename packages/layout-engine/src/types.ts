import type { ComponentRegistry } from "@agidn/component-registry";
import type { LayoutNode } from "@agidn/document-schema";

export interface CollectionRef {
  parentId: string;
  slot?: string;
}

export interface DropTarget extends CollectionRef {
  beforeNodeId?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

export type DropPosition = "before" | "inside" | "after";

export type DropErrorCode =
  | "dropTargetMissing"
  | "sourceOrTargetMissing"
  | "selfOrDescendant"
  | "requiredSourceSlot"
  | "alreadyAtPosition"
  | "nodeMissing"
  | "alreadyFirst"
  | "alreadyLast"
  | "invalidTarget"
  | "slotRejected"
  | "maxItemsExceeded"
  | "layoutNestingRejected"
  | "layoutDepthExceeded";

export type DropResolution =
  | { valid: true; target: DropTarget; position: DropPosition }
  | { valid: false; reason: DropErrorCode };

export type InsertSource =
  | { kind: "component"; componentRef: string }
  | { kind: "layout"; layout: LayoutNode["layout"] };

export type DragSource =
  | { type: "existing"; nodeId: string }
  | { type: "insert"; source: InsertSource };

export interface DropPolicy {
  components: Pick<ComponentRegistry, "components">;
  maxLayoutDepth?: number;
}

export interface GeometryItem {
  nodeId: string;
  rect: Rect;
}

export interface GeometryZone {
  zoneId: string;
  collection: CollectionRef;
  ownerNodeId: string;
  depth: number;
  rect: Rect;
  contentRect?: Rect;
  layout: "stack" | "row" | "grid" | "overlay" | "slot";
  items: readonly GeometryItem[];
}
