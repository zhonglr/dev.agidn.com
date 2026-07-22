import type { ComponentNode, LayoutNode, PageDocument, PageNode } from "@agidn/document-schema";

export interface NodeLocation {
  node: PageNode;
  parent?: PageNode | undefined;
  slot?: string | undefined;
  collection: PageNode[];
  index: number;
}

export function findNodeLocation(document: PageDocument, nodeId: string): NodeLocation | undefined {
  const search = (collection: PageNode[], parent?: PageNode, slot?: string): NodeLocation | undefined => {
    for (const [index, node] of collection.entries()) {
      if (node.id === nodeId) return { node, parent, slot, collection, index };
      if (node.kind === "layout") {
        const found = search(node.children, node);
        if (found) return found;
      } else {
        for (const [slotName, children] of Object.entries(node.slots ?? {})) {
          const found = search(children, node, slotName);
          if (found) return found;
        }
      }
    }
    return undefined;
  };
  return search(document.children);
}

export function containsNode(node: PageNode, nodeId: string): boolean {
  if (node.id === nodeId) return true;
  const children = node.kind === "layout" ? node.children : Object.values(node.slots ?? {}).flat();
  return children.some((child) => containsNode(child, nodeId));
}

export function detachNode(location: NodeLocation): PageNode {
  const [node] = location.collection.splice(location.index, 1);
  if (!node) throw new Error(`Node '${location.node.id}' disappeared during command application.`);
  return node;
}

export function childCollection(parent: PageNode, targetSlot?: string): PageNode[] | undefined {
  if (parent.kind === "layout") return targetSlot ? undefined : parent.children;
  if (!targetSlot) return undefined;
  return (parent.slots ??= {})[targetSlot] ??= [];
}

export function insertBefore(collection: PageNode[], node: PageNode, beforeNodeId?: string): boolean {
  if (!beforeNodeId) {
    collection.push(node);
    return true;
  }
  const index = collection.findIndex((candidate) => candidate.id === beforeNodeId);
  if (index === -1) return false;
  collection.splice(index, 0, node);
  return true;
}

export function isLayoutNode(node: PageNode): node is LayoutNode {
  return node.kind === "layout";
}

export function isComponentNode(node: PageNode): node is ComponentNode {
  return node.kind === "component";
}
