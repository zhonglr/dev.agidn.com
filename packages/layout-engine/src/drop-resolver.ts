import type { PageDocument, PageNode } from "@agidn/document-schema";
import {
  firstCompatibleSlot,
  layoutCanContain,
  resolveSource,
  validateTargetCollection,
  type ResolvedSource
} from "./drop-policy.js";
import { createTreeIndex, sameCollection, type TreeIndex } from "./tree-index.js";
import type {
  CollectionRef,
  DragSource,
  DropPolicy,
  DropResolution,
  DropTarget,
  GeometryItem,
  GeometryZone,
  Point,
  Rect
} from "./types.js";

export interface NodeDropInput {
  document: PageDocument;
  policy: DropPolicy;
  source: DragSource;
  hitNodeId: string;
  pointer?: Point;
  hitRect?: Rect;
}

export interface GeometryDropInput {
  document: PageDocument;
  policy: DropPolicy;
  source: DragSource;
  pointer: Point;
  zones: readonly GeometryZone[];
  snapDistance?: number;
}

function isHorizontalCollection(parent: PageDocument | PageNode): boolean {
  return parent.kind === "layout" && (parent.layout === "row" || parent.layout === "grid");
}

function axisRatio(
  parent: PageDocument | PageNode,
  pointer: Point | undefined,
  hitRect: Rect | undefined
): number {
  if (!pointer || !hitRect) return 0.5;
  if (isHorizontalCollection(parent)) {
    return hitRect.width > 0 ? (pointer.x - hitRect.x) / hitRect.width : 0.5;
  }
  return hitRect.height > 0 ? (pointer.y - hitRect.y) / hitRect.height : 0.5;
}

function verticalRatio(pointer: Point | undefined, hitRect: Rect | undefined): number {
  return pointer && hitRect && hitRect.height > 0
    ? (pointer.y - hitRect.y) / hitRect.height
    : 0.5;
}

function targetWithBefore(ref: CollectionRef, beforeNodeId?: string): DropTarget {
  return { ...ref, ...(beforeNodeId ? { beforeNodeId } : {}) };
}

function isNoop(
  source: ResolvedSource,
  target: CollectionRef,
  collection: readonly PageNode[],
  beforeNodeId: string | undefined
): boolean {
  if (!source.location || !sameCollection(source.location.collectionRef, target)) return false;
  const current = collection.map(({ id }) => id);
  const reordered = current.filter((id) => id !== source.location!.node.id);
  const targetIndex = beforeNodeId ? reordered.indexOf(beforeNodeId) : reordered.length;
  if (targetIndex < 0) return false;
  reordered.splice(targetIndex, 0, source.location.node.id);
  return reordered.every((id, index) => id === current[index]);
}

function resolveCollection(
  index: TreeIndex,
  policy: DropPolicy,
  source: ResolvedSource,
  target: CollectionRef,
  beforeNodeId: string | undefined,
  position: "before" | "inside" | "after"
): DropResolution {
  const validation = validateTargetCollection(index, policy, source, target);
  if (!validation.valid) return validation;
  if (beforeNodeId && !validation.collection.some(({ id }) => id === beforeNodeId)) {
    return { valid: false, reason: "invalidTarget" };
  }
  if (isNoop(source, target, validation.collection, beforeNodeId)) {
    return { valid: false, reason: "alreadyAtPosition" };
  }
  return {
    valid: true,
    target: targetWithBefore(target, beforeNodeId),
    position
  };
}

export function resolveNodeDrop(input: NodeDropInput): DropResolution {
  const index = createTreeIndex(input.document);
  const source = resolveSource(index, input.source);
  if (!source) {
    return {
      valid: false,
      reason: "sourceOrTargetMissing"
    };
  }
  if (input.hitNodeId === input.document.id) {
    return resolveCollection(
      index,
      input.policy,
      source,
      { parentId: input.document.id },
      undefined,
      "inside"
    );
  }
  const hit = index.get(input.hitNodeId);
  if (!hit) {
    return {
      valid: false,
      reason: input.source.type === "existing"
        ? "sourceOrTargetMissing"
        : "dropTargetMissing"
    };
  }
  if (source.location && index.contains(source.location.node.id, hit.node.id)) {
    return { valid: false, reason: "selfOrDescendant" };
  }

  let firstRejection: DropResolution | undefined;
  const band = verticalRatio(input.pointer, input.hitRect);
  if (band >= 0.25 && band <= 0.75) {
    const slot = firstCompatibleSlot(input.policy, hit.node, source);
    if (slot) {
      const resolution = resolveCollection(
        index,
        input.policy,
        source,
        { parentId: hit.node.id, slot },
        undefined,
        "inside"
      );
      if (resolution.valid) return resolution;
      if (source.location) return resolution;
      firstRejection = resolution;
    }
    if (
      hit.node.kind === "layout" &&
      layoutCanContain(hit.node, source.location?.node ?? source.descriptor)
    ) {
      const resolution = resolveCollection(
        index,
        input.policy,
        source,
        { parentId: hit.node.id },
        undefined,
        "inside"
      );
      if (resolution.valid) return resolution;
      if (source.location) return resolution;
      firstRejection ??= resolution;
    }
  }

  const ratio = axisRatio(hit.parent, input.pointer, input.hitRect);
  const beforeNodeId = ratio < 0.5 ? hit.node.id : hit.collection[hit.index + 1]?.id;
  const direct = resolveCollection(
    index,
    input.policy,
    source,
    hit.collectionRef,
    beforeNodeId,
    ratio < 0.5 ? "before" : "after"
  );
  if (direct.valid) return direct;
  firstRejection ??= direct;
  if (source.location) return firstRejection;

  const attemptedCollections = new Set([
    `${hit.collectionRef.parentId}\u0000${hit.collectionRef.slot ?? ""}`
  ]);
  for (const ancestorId of [...hit.ancestorIds].reverse()) {
    const ancestor = index.get(ancestorId);
    if (!ancestor) continue;
    const collectionKey = `${ancestor.collectionRef.parentId}\u0000${ancestor.collectionRef.slot ?? ""}`;
    if (attemptedCollections.has(collectionKey)) continue;
    attemptedCollections.add(collectionKey);
    const ancestorBeforeNodeId =
      ratio < 0.5
        ? ancestor.node.id
        : ancestor.collection[ancestor.index + 1]?.id;
    const resolution = resolveCollection(
      index,
      input.policy,
      source,
      ancestor.collectionRef,
      ancestorBeforeNodeId,
      ratio < 0.5 ? "before" : "after"
    );
    if (resolution.valid) return resolution;
    firstRejection ??= resolution;
  }
  return firstRejection;
}

function distanceToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

function centerX(item: GeometryItem): number {
  return item.rect.x + item.rect.width / 2;
}

function centerY(item: GeometryItem): number {
  return item.rect.y + item.rect.height / 2;
}

function beforeForLinear(
  items: readonly GeometryItem[],
  pointer: Point,
  axis: "x" | "y"
): string | undefined {
  const sorted = [...items].sort((left, right) =>
    axis === "x" ? centerX(left) - centerX(right) : centerY(left) - centerY(right)
  );
  return sorted.find((item) =>
    axis === "x" ? pointer.x < centerX(item) : pointer.y < centerY(item)
  )?.nodeId;
}

interface GeometryRow {
  items: GeometryItem[];
  top: number;
  bottom: number;
  center: number;
}

function gridRows(items: readonly GeometryItem[]): GeometryRow[] {
  const sorted = [...items].sort((left, right) => {
    const vertical = centerY(left) - centerY(right);
    return Math.abs(vertical) > 0.5 ? vertical : centerX(left) - centerX(right);
  });
  const rows: GeometryRow[] = [];
  for (const item of sorted) {
    const top = item.rect.y;
    const bottom = item.rect.y + item.rect.height;
    const matching = rows.find((row) => Math.min(row.bottom, bottom) - Math.max(row.top, top) > 0);
    if (matching) {
      matching.items.push(item);
      matching.top = Math.min(matching.top, top);
      matching.bottom = Math.max(matching.bottom, bottom);
      matching.center = (matching.top + matching.bottom) / 2;
    } else {
      rows.push({ items: [item], top, bottom, center: (top + bottom) / 2 });
    }
  }
  rows.sort((left, right) => left.center - right.center);
  for (const row of rows) row.items.sort((left, right) => centerX(left) - centerX(right));
  return rows;
}

function beforeForGrid(items: readonly GeometryItem[], pointer: Point): string | undefined {
  const rows = gridRows(items);
  if (rows.length === 0) return undefined;
  let rowIndex = rows.findIndex((row) => pointer.y <= row.bottom);
  if (rowIndex < 0) rowIndex = rows.length - 1;
  const row = rows[rowIndex]!;
  const inRow = row.items.find((item) => pointer.x < centerX(item));
  if (inRow) return inRow.nodeId;
  return rows[rowIndex + 1]?.items[0]?.nodeId;
}

function beforeForZone(
  zone: GeometryZone,
  source: ResolvedSource,
  pointer: Point
): string | undefined {
  const sourceNodeId = source.location?.node.id;
  const items = sourceNodeId
    ? zone.items.filter(({ nodeId }) => nodeId !== sourceNodeId)
    : zone.items;
  if (zone.layout === "grid") return beforeForGrid(items, pointer);
  if (zone.layout === "row") return beforeForLinear(items, pointer, "x");
  return beforeForLinear(items, pointer, "y");
}

export function resolveGeometryDrop(input: GeometryDropInput): DropResolution {
  const index = createTreeIndex(input.document);
  const source = resolveSource(index, input.source);
  if (!source) return { valid: false, reason: "sourceOrTargetMissing" };
  const snapDistance = input.snapDistance ?? 8;
  const candidates = input.zones
    .filter((zone) => distanceToRect(input.pointer, zone.contentRect ?? zone.rect) <= snapDistance)
    .sort((left, right) => right.depth - left.depth);

  let firstRejection: DropResolution | undefined;
  for (const zone of candidates) {
    const beforeNodeId = beforeForZone(zone, source, input.pointer);
    const resolution = resolveCollection(
      index,
      input.policy,
      source,
      zone.collection,
      beforeNodeId,
      beforeNodeId ? "before" : "inside"
    );
    if (resolution.valid) return resolution;
    firstRejection ??= resolution;
  }
  return firstRejection ?? { valid: false, reason: "dropTargetMissing" };
}

export function resolveSiblingDrop(
  document: PageDocument,
  sourceNodeId: string,
  direction: "up" | "down"
): DropResolution {
  const index = createTreeIndex(document);
  const source = index.get(sourceNodeId);
  if (!source) return { valid: false, reason: "nodeMissing" };
  const targetIndex = direction === "up" ? source.index - 1 : source.index + 1;
  if (targetIndex < 0 || targetIndex >= source.collection.length) {
    return { valid: false, reason: direction === "up" ? "alreadyFirst" : "alreadyLast" };
  }
  const beforeNodeId =
    direction === "up"
      ? source.collection[targetIndex]!.id
      : source.collection[targetIndex + 1]?.id;
  return {
    valid: true,
    target: targetWithBefore(source.collectionRef, beforeNodeId),
    position: direction === "up" ? "before" : "after"
  };
}
