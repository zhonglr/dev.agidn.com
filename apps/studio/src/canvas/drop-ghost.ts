import { findNode, type PageDocument, type PageNode } from "@agidn/document-schema";

export interface DropGhostTarget {
  parentId: string;
  slot?: string;
  beforeNodeId?: string;
}

export interface DropGhostState {
  target: DropGhostTarget;
  nodes: readonly PageNode[];
  moveSourceNodeId?: string;
}

export const DROP_GHOST_ID_PREFIX = "ghost/";

export function sameDropGhost(left: DropGhostState | undefined, right: DropGhostState): boolean {
  return Boolean(
    left &&
    left.nodes.length === right.nodes.length &&
    left.nodes.every((node, index) => node.id === right.nodes[index]?.id) &&
    left.moveSourceNodeId === right.moveSourceNodeId &&
    left.target.parentId === right.target.parentId &&
    left.target.slot === right.target.slot &&
    left.target.beforeNodeId === right.target.beforeNodeId
  );
}

function retagNodeIds(node: PageNode): PageNode {
  const cloned = structuredClone(node);
  const retag = (current: PageNode): void => {
    current.id = `${DROP_GHOST_ID_PREFIX}${current.id}`;
    (current.kind === "layout" ? current.children : Object.values(current.slots ?? {}).flat()).forEach(retag);
  };
  retag(cloned);
  return cloned;
}

/**
 * Returns a derived document with the ghost node inserted at the exact target
 * collection and index, so the preview reflows siblings exactly like the real
 * drop would. Returns the original document when the target cannot be found.
 */
export function applyDropGhost(document: PageDocument, ghost: DropGhostState): PageDocument {
  const draft = structuredClone(document);
  let collection: PageNode[] | undefined;
  if (ghost.target.parentId === draft.id) {
    collection = draft.children;
  } else {
    const parent = findNode(draft, ghost.target.parentId);
    if (parent?.kind === "layout" && !ghost.target.slot) {
      collection = parent.children;
    } else if (parent?.kind === "component" && ghost.target.slot) {
      collection = (parent.slots ??= {})[ghost.target.slot] ??= [];
    }
  }
  if (!collection) return document;
  const index = ghost.target.beforeNodeId
    ? collection.findIndex(({ id }) => id === ghost.target.beforeNodeId)
    : collection.length;
  collection.splice(
    index < 0 ? collection.length : index,
    0,
    ...ghost.nodes.map(retagNodeIds)
  );
  return draft;
}
