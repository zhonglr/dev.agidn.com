import type { PageDocument, PageNode } from "@agidn/document-schema";
import type { IndexedNodeLocation, TreeIndex } from "./tree-index.js";
import { createTreeIndex, sameCollection, subtreeLayoutDepth } from "./tree-index.js";
import type {
  CollectionRef,
  DragSource,
  DropErrorCode,
  DropPolicy,
  DropResolution,
  DropTarget,
  InsertSource
} from "./types.js";

export interface ResolvedSource {
  descriptor: InsertSource;
  location?: IndexedNodeLocation;
}

export type TargetValidation =
  | { valid: true; parent: PageDocument | PageNode; collection: readonly PageNode[] }
  | { valid: false; reason: DropErrorCode };

function acceptsSource(accepts: readonly string[] | undefined, source: InsertSource): boolean {
  const allowed = accepts ?? ["*"];
  return allowed.includes("*") || (
    source.kind === "component" &&
    Boolean(source.componentRef) &&
    allowed.includes(source.componentRef!)
  );
}

export function resolveSource(index: TreeIndex, source: DragSource): ResolvedSource | undefined {
  if (source.type === "insert") return { descriptor: source.source };
  const location = index.get(source.nodeId);
  if (!location) return undefined;
  return {
    descriptor:
      location.node.kind === "component"
        ? { kind: "component", componentRef: location.node.componentRef }
        : { kind: "layout", layout: location.node.layout },
    location
  };
}

export function layoutCanContain(target: PageNode, source: PageNode | InsertSource): boolean {
  if (target.kind !== "layout" || source.kind !== "layout") return target.kind === "layout";
  const sourceLayout = "layout" in source ? source.layout : undefined;
  if (!sourceLayout) return true;
  if (sourceLayout === "section") return target.layout === "overlay";
  if (sourceLayout === "container") return target.layout === "section" || target.layout === "overlay";
  return true;
}

export function firstCompatibleSlot(
  policy: DropPolicy,
  target: PageNode,
  source: ResolvedSource
): string | undefined {
  if (target.kind !== "component") return undefined;
  const definition = policy.components.components[target.componentRef];
  for (const [slotName, slot] of Object.entries(definition?.slots ?? {})) {
    if (!acceptsSource(slot.accepts, source.descriptor)) continue;
    const existing = target.slots?.[slotName]?.length ?? 0;
    const sameSourceCollection =
      source.location !== undefined &&
      sameCollection(source.location.collectionRef, { parentId: target.id, slot: slotName });
    if (slot.maxItems === undefined || existing - (sameSourceCollection ? 1 : 0) < slot.maxItems) {
      return slotName;
    }
  }
  return undefined;
}

function sourceRequiredSlotWouldEmpty(
  policy: DropPolicy,
  source: ResolvedSource,
  target: CollectionRef
): boolean {
  const location = source.location;
  if (!location || location.parent.kind !== "component" || !location.collectionRef.slot) return false;
  if (sameCollection(location.collectionRef, target)) return false;
  const slot = policy.components.components[location.parent.componentRef]?.slots[location.collectionRef.slot];
  const remaining = location.collection.length - 1;
  return Boolean(
    slot &&
    ((slot.required === true && remaining === 0) ||
      (slot.minItems !== undefined && remaining < slot.minItems))
  );
}

function parentLayoutDepth(index: TreeIndex, parent: PageDocument | PageNode): number {
  if (parent.kind === "page") return 0;
  return index.get(parent.id)?.layoutDepth ?? 0;
}

function exceedsLayoutDepth(
  index: TreeIndex,
  policy: DropPolicy,
  source: ResolvedSource,
  parent: PageDocument | PageNode
): boolean {
  if (policy.maxLayoutDepth === undefined) return false;
  const sourceDepth = source.location
    ? subtreeLayoutDepth(source.location.node)
    : source.descriptor.kind === "layout"
      ? 1
      : 0;
  return (
    parentLayoutDepth(index, parent) + sourceDepth >
    policy.maxLayoutDepth
  );
}

export function validateTargetCollection(
  index: TreeIndex,
  policy: DropPolicy,
  source: ResolvedSource,
  target: CollectionRef
): TargetValidation {
  const parent = index.parent(target);
  if (!parent) return { valid: false, reason: "invalidTarget" };
  if (source.location && index.contains(source.location.node.id, target.parentId)) {
    return { valid: false, reason: "selfOrDescendant" };
  }

  let collection: readonly PageNode[] | undefined;
  if (parent.kind === "page") {
    if (target.slot) return { valid: false, reason: "invalidTarget" };
    if (
      source.descriptor.kind === "layout" &&
      source.descriptor.layout === "container"
    ) {
      return { valid: false, reason: "layoutNestingRejected" };
    }
    collection = parent.children;
  } else if (parent.kind === "layout") {
    if (target.slot) return { valid: false, reason: "invalidTarget" };
    if (!layoutCanContain(parent, source.location?.node ?? source.descriptor)) {
      return { valid: false, reason: "layoutNestingRejected" };
    }
    collection = parent.children;
  } else {
    if (!target.slot) return { valid: false, reason: "invalidTarget" };
    if (
      source.descriptor.kind === "layout" &&
      (source.descriptor.layout === "section" ||
        source.descriptor.layout === "container")
    ) {
      return { valid: false, reason: "layoutNestingRejected" };
    }
    const slot = policy.components.components[parent.componentRef]?.slots[target.slot];
    if (!slot || !acceptsSource(slot.accepts, source.descriptor)) {
      return { valid: false, reason: "slotRejected" };
    }
    collection = parent.slots?.[target.slot] ?? [];
    const sameSourceCollection =
      source.location !== undefined && sameCollection(source.location.collectionRef, target);
    if (
      slot.maxItems !== undefined &&
      collection.length - (sameSourceCollection ? 1 : 0) >= slot.maxItems
    ) {
      return { valid: false, reason: "maxItemsExceeded" };
    }
  }

  if (sourceRequiredSlotWouldEmpty(policy, source, target)) {
    return { valid: false, reason: "requiredSourceSlot" };
  }
  if (exceedsLayoutDepth(index, policy, source, parent)) {
    return { valid: false, reason: "layoutDepthExceeded" };
  }
  return { valid: true, parent, collection };
}

export function validateInsertSourcesTarget(
  document: PageDocument,
  policy: DropPolicy,
  sources: readonly InsertSource[],
  target: DropTarget
): DropResolution {
  if (sources.length === 0) return { valid: false, reason: "invalidTarget" };
  const index = createTreeIndex(document);
  let collection: readonly PageNode[] | undefined;
  for (const descriptor of sources) {
    const validation = validateTargetCollection(
      index,
      policy,
      { descriptor },
      target
    );
    if (!validation.valid) return validation;
    collection = validation.collection;
  }
  if (
    target.beforeNodeId &&
    !collection?.some(({ id }) => id === target.beforeNodeId)
  ) {
    return { valid: false, reason: "invalidTarget" };
  }
  const parent = index.parent(target);
  if (parent?.kind === "component" && target.slot) {
    const slot =
      policy.components.components[parent.componentRef]?.slots[target.slot];
    if (
      slot?.maxItems !== undefined &&
      (collection?.length ?? 0) + sources.length > slot.maxItems
    ) {
      return { valid: false, reason: "maxItemsExceeded" };
    }
  }
  return {
    valid: true,
    target,
    position: target.beforeNodeId ? "before" : "inside"
  };
}
