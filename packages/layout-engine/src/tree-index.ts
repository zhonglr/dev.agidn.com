import type { PageDocument, PageNode } from "@agidn/document-schema";
import type { CollectionRef } from "./types.js";

export interface IndexedNodeLocation {
  node: PageNode;
  parent: PageDocument | PageNode;
  collection: readonly PageNode[];
  collectionRef: CollectionRef;
  index: number;
  depth: number;
  layoutDepth: number;
  ancestorIds: readonly string[];
}

export interface TreeIndex {
  document: PageDocument;
  get(nodeId: string): IndexedNodeLocation | undefined;
  has(nodeId: string): boolean;
  contains(ancestorNodeId: string, nodeId: string): boolean;
  collection(ref: CollectionRef): readonly PageNode[] | undefined;
  parent(ref: CollectionRef): PageDocument | PageNode | undefined;
}

interface CollectionFrame {
  parent: PageDocument | PageNode;
  collection: readonly PageNode[];
  ref: CollectionRef;
  depth: number;
  parentLayoutDepth: number;
  ancestorIds: readonly string[];
}

function collectionKey(ref: CollectionRef): string {
  return `${ref.parentId}\u0000${ref.slot ?? ""}`;
}

export function sameCollection(left: CollectionRef, right: CollectionRef): boolean {
  return left.parentId === right.parentId && left.slot === right.slot;
}

export function createTreeIndex(document: PageDocument): TreeIndex {
  const locations = new Map<string, IndexedNodeLocation>();
  const collections = new Map<string, { parent: PageDocument | PageNode; nodes: readonly PageNode[] }>();
  const stack: CollectionFrame[] = [{
    parent: document,
    collection: document.children,
    ref: { parentId: document.id },
    depth: 0,
    parentLayoutDepth: 0,
    ancestorIds: []
  }];

  while (stack.length > 0) {
    const frame = stack.pop()!;
    collections.set(collectionKey(frame.ref), { parent: frame.parent, nodes: frame.collection });
    for (let index = frame.collection.length - 1; index >= 0; index -= 1) {
      const node = frame.collection[index]!;
      const layoutDepth = frame.parentLayoutDepth + (node.kind === "layout" ? 1 : 0);
      locations.set(node.id, {
        node,
        parent: frame.parent,
        collection: frame.collection,
        collectionRef: frame.ref,
        index,
        depth: frame.depth,
        layoutDepth,
        ancestorIds: frame.ancestorIds
      });

      const ancestorIds = [...frame.ancestorIds, node.id];
      if (node.kind === "layout") {
        stack.push({
          parent: node,
          collection: node.children,
          ref: { parentId: node.id },
          depth: frame.depth + 1,
          parentLayoutDepth: layoutDepth,
          ancestorIds
        });
      } else {
        const slots = Object.entries(node.slots ?? {});
        for (let slotIndex = slots.length - 1; slotIndex >= 0; slotIndex -= 1) {
          const [slot, children] = slots[slotIndex]!;
          stack.push({
            parent: node,
            collection: children,
            ref: { parentId: node.id, slot },
            depth: frame.depth + 1,
            parentLayoutDepth: layoutDepth,
            ancestorIds
          });
        }
      }
    }
  }

  const parent = (ref: CollectionRef): PageDocument | PageNode | undefined => {
    if (ref.parentId === document.id) return ref.slot ? undefined : document;
    const location = locations.get(ref.parentId);
    if (!location) return undefined;
    if (location.node.kind === "layout") return ref.slot ? undefined : location.node;
    return ref.slot ? location.node : undefined;
  };

  const collection = (ref: CollectionRef): readonly PageNode[] | undefined => {
    const indexed = collections.get(collectionKey(ref));
    if (indexed) return indexed.nodes;
    const targetParent = parent(ref);
    if (targetParent?.kind === "component" && ref.slot) return targetParent.slots?.[ref.slot] ?? [];
    return undefined;
  };

  return {
    document,
    get: (nodeId) => locations.get(nodeId),
    has: (nodeId) => locations.has(nodeId),
    contains: (ancestorNodeId, nodeId) => {
      if (ancestorNodeId === nodeId) return true;
      return locations.get(nodeId)?.ancestorIds.includes(ancestorNodeId) ?? false;
    },
    collection,
    parent
  };
}

export function subtreeLayoutDepth(node: PageNode): number {
  let maximum = 0;
  const stack: Array<{ node: PageNode; layoutDepth: number }> = [{ node, layoutDepth: 0 }];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const layoutDepth = current.layoutDepth + (current.node.kind === "layout" ? 1 : 0);
    maximum = Math.max(maximum, layoutDepth);
    const children =
      current.node.kind === "layout"
        ? current.node.children
        : Object.values(current.node.slots ?? {}).flat();
    for (const child of children) stack.push({ node: child, layoutDepth });
  }
  return maximum;
}
