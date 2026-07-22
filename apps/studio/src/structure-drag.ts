import type { GetCatalogResponse } from "@agidn/api-protocol";
import type { PageDocument, PageNode } from "@agidn/document-schema";

export const NODE_DRAG_MIME = "application/x-agidn-node";

export interface MoveTarget {
  parentId: string;
  slot?: string;
  beforeNodeId?: string;
}

export type MoveResolution = { valid: true; target: MoveTarget; position: "before" | "inside" | "after" } | { valid: false; reason: string };

interface NodeLocation {
  node: PageNode;
  parent: PageDocument | PageNode;
  slot?: string;
  collection: PageNode[];
  index: number;
}

function children(node: PageNode): PageNode[] {
  return node.kind === "layout" ? node.children : Object.values(node.slots ?? {}).flat();
}

function contains(node: PageNode, nodeId: string): boolean {
  return node.id === nodeId || children(node).some((child) => contains(child, nodeId));
}

function layoutCanContain(target: PageNode, source: PageNode): boolean {
  if (target.kind !== "layout" || source.kind !== "layout") return target.kind === "layout";
  if (source.layout === "section") return target.layout === "overlay";
  if (source.layout === "container") return target.layout === "section" || target.layout === "overlay";
  return true;
}

function findLocation(document: PageDocument, nodeId: string): NodeLocation | undefined {
  const visit = (collection: PageNode[], parent: PageDocument | PageNode, slot?: string): NodeLocation | undefined => {
    for (const [index, node] of collection.entries()) {
      if (node.id === nodeId) return { node, parent, collection, index, ...(slot ? { slot } : {}) };
      if (node.kind === "layout") {
        const found = visit(node.children, node);
        if (found) return found;
      } else {
        for (const [slotName, slotChildren] of Object.entries(node.slots ?? {})) {
          const found = visit(slotChildren, node, slotName);
          if (found) return found;
        }
      }
    }
    return undefined;
  };
  return visit(document.children, document);
}

function collectionKey(parent: PageDocument | PageNode, slot?: string): string {
  return `${parent.id}:${slot ?? "children"}`;
}

function slotForNode(catalog: GetCatalogResponse, target: PageNode, source: PageNode, sourceLocation: NodeLocation): string | undefined {
  if (target.kind !== "component") return undefined;
  const definition = catalog.components.components[target.componentRef];
  for (const [slotName, slot] of Object.entries(definition?.slots ?? {})) {
    const accepts = slot.accepts ?? ["*"];
    const accepted = accepts.includes("*") || (source.kind === "component" && accepts.includes(source.componentRef));
    const existing = target.slots?.[slotName]?.length ?? 0;
    const sameCollection = sourceLocation.parent.id === target.id && sourceLocation.slot === slotName;
    if (accepted && (slot.maxItems === undefined || existing - (sameCollection ? 1 : 0) < slot.maxItems)) return slotName;
  }
  return undefined;
}

function requiredSourceWouldEmpty(catalog: GetCatalogResponse, source: NodeLocation, targetParent: PageDocument | PageNode, targetSlot?: string): boolean {
  if (source.parent.kind !== "component" || !source.slot) return false;
  if (collectionKey(source.parent, source.slot) === collectionKey(targetParent, targetSlot)) return false;
  const slot = catalog.components.components[source.parent.componentRef]?.slots[source.slot];
  const remaining = source.collection.length - 1;
  return Boolean(slot && (slot.required && remaining === 0 || slot.minItems !== undefined && remaining < slot.minItems));
}

function isNoop(source: NodeLocation, targetParent: PageDocument | PageNode, targetSlot: string | undefined, beforeNodeId: string | undefined): boolean {
  if (collectionKey(source.parent, source.slot) !== collectionKey(targetParent, targetSlot)) return false;
  const current = source.collection.map(({ id }) => id);
  const reordered = current.filter((id) => id !== source.node.id);
  const index = beforeNodeId ? reordered.indexOf(beforeNodeId) : reordered.length;
  if (index < 0) return false;
  reordered.splice(index, 0, source.node.id);
  return reordered.every((id, itemIndex) => id === current[itemIndex]);
}

export function resolveMoveTarget(
  document: PageDocument,
  catalog: GetCatalogResponse,
  sourceNodeId: string,
  hitNodeId: string,
  pointerY: number,
  hitRect: { y: number; height: number }
): MoveResolution {
  const source = findLocation(document, sourceNodeId);
  const hit = findLocation(document, hitNodeId);
  if (!source || !hit) return { valid: false, reason: "The dragged node or drop target no longer exists." };
  if (contains(source.node, hit.node.id)) return { valid: false, reason: "A node cannot be moved into itself or one of its descendants." };

  const ratio = hitRect.height > 0 ? (pointerY - hitRect.y) / hitRect.height : 0.5;
  const insideSlot = ratio >= 0.25 && ratio <= 0.75 ? slotForNode(catalog, hit.node, source.node, source) : undefined;
  let targetParent: PageDocument | PageNode;
  let targetSlot: string | undefined;
  let beforeNodeId: string | undefined;
  let position: "before" | "inside" | "after";

  if (insideSlot) {
    targetParent = hit.node;
    targetSlot = insideSlot;
    position = "inside";
  } else if (hit.node.kind === "layout" && ratio >= 0.25 && ratio <= 0.75 && layoutCanContain(hit.node, source.node)) {
    targetParent = hit.node;
    position = "inside";
  } else {
    targetParent = hit.parent;
    targetSlot = hit.slot;
    if (ratio < 0.5) {
      beforeNodeId = hit.node.id;
      position = "before";
    } else {
      beforeNodeId = hit.collection[hit.index + 1]?.id;
      position = "after";
    }
  }

  if (requiredSourceWouldEmpty(catalog, source, targetParent, targetSlot)) {
    return { valid: false, reason: "The source slot requires this child and cannot be left empty." };
  }
  if (isNoop(source, targetParent, targetSlot, beforeNodeId)) return { valid: false, reason: "The node is already at this position." };
  return {
    valid: true,
    target: { parentId: targetParent.id, ...(targetSlot ? { slot: targetSlot } : {}), ...(beforeNodeId ? { beforeNodeId } : {}) },
    position
  };
}

export function resolveSiblingMove(document: PageDocument, sourceNodeId: string, direction: "up" | "down"): MoveResolution {
  const source = findLocation(document, sourceNodeId);
  if (!source) return { valid: false, reason: "The node no longer exists." };
  const targetIndex = direction === "up" ? source.index - 1 : source.index + 1;
  if (targetIndex < 0 || targetIndex >= source.collection.length) return { valid: false, reason: `The node is already ${direction === "up" ? "first" : "last"} in this group.` };
  const beforeNodeId = direction === "up" ? source.collection[targetIndex]!.id : source.collection[targetIndex + 1]?.id;
  return {
    valid: true,
    target: { parentId: source.parent.id, ...(source.slot ? { slot: source.slot } : {}), ...(beforeNodeId ? { beforeNodeId } : {}) },
    position: direction === "up" ? "before" : "after"
  };
}
